"""Lanza una tarea del arnes con el Coder de UN brazo del experimento (19-sep).

El experimento: la misma tarea, el mismo contrato, los mismos checks y el mismo
prompt, con dos Coders distintos corriendo a la vez en dos worktrees. Lo unico
que cambia entre brazos es el modelo, y lo que cambia vive AQUI, versionado —
no en la linea de comandos de quien lanza, que no deja rastro (F-136; CLAUDE.md 11.2, regla 5).

    python -m harness.experimento.brazo deepseek harness/tasks/ADMIN-02.json
    python -m harness.experimento.brazo atria    harness/tasks/ADMIN-02.json
    python -m harness.experimento.brazo atria    --sonda

Todo lo que va despues del nombre del brazo pasa tal cual a `harness.graph.run`
(`--seco`, `--corrida`, `--plazo`). `--sonda` hace UNA llamada minima al
proveedor y enseña la forma de la respuesta —modelo, `finish_reason`, campos de
`usage`, si trae razonamiento— antes de gastar en la corrida de verdad.

**El brazo `deepseek` no pone ni una variable:** es el arnes tal cual, el de
`CLAUDE.md` §3, y es el que cuenta para la remedicion. Y se niega a arrancar si
el entorno ya trae alguna de las variables del otro brazo: una variable olvidada
en la consola convertiria en silencio la corrida oficial en otra cosa.
"""
import os
import sys
import time

# Las variables que definen un brazo. `harness.core.llm` y `pricing` las leen AL
# IMPORTARSE, asi que este modulo no importa nada del arnes antes de fijarlas.
VARIABLES = (
    "HARNESS_CODER_MODEL", "HARNESS_CODER_BASE", "HARNESS_CODER_KEY_ENV",
    "HARNESS_CODER_MAX_TOKENS_CAP", "DS_MAX_TOKENS",
    # Las dos que faltaban, y no son menores: `HARNESS_CODER_TIMEOUT` decide
    # cuando una llamada lenta se declara colgada —y se REPITE pagando— y
    # `HARNESS_E2E_LOCK` decide si los dos brazos comparten turno o no. Una de
    # ellas olvidada en la consola deja al brazo oficial corriendo con otra
    # configuracion sin que nada lo diga.
    "HARNESS_CODER_TIMEOUT", "HARNESS_E2E_LOCK", "HARNESS_CODER_STREAM",
    "DS_PRICE_IN_HIT", "DS_PRICE_IN_MISS", "DS_PRICE_OUT",
    "HARNESS_PRICE_TABLE_DATE", "HARNESS_PRICE_NOTE",
)

BRAZOS = {
    # El arnes tal cual. Ni una variable.
    "deepseek": {},
    # Atria Dawn Preview (ATRIA / Shanghai AI Lab, 11-sep-2026). API compatible
    # OpenAI, segun api.atria-asi.ai/docs: base `/v1`, modelo sensible a
    # mayusculas, `max_tokens` entre 1 y 65536, 60 peticiones por minuto.
    "atria": {
        "HARNESS_CODER_MODEL": "Atria-Dawn-Preview",
        "HARNESS_CODER_BASE": "https://api.atria-asi.ai/v1",
        "HARNESS_CODER_KEY_ENV": "ATRIA_API_KEY",
        "HARNESS_CODER_MAX_TOKENS_CAP": "65536",
        # ⚠ 1500 s y no los 300 de DeepSeek, y no es un capricho. `TIMEOUT` es el
        # plazo de CADA OPERACION DE SOCKET sobre una llamada SIN streaming: si
        # el servidor no manda un byte hasta terminar de generar, una generacion
        # mas larga que el plazo se ve como un CORTE DE CONEXION — y F-119 manda
        # reintentarla, o sea PAGAR OTRA VEZ la misma respuesta, hasta tres
        # veces. Con DeepSeek nunca pasa porque su API manda lineas vacias de
        # keep-alive mientras piensa; Atria no documenta que lo haga, y una
        # respuesta de ocho ficheros puede pasar de 300 s de sobra (FORO-03 gasto
        # 56 067 tokens de salida en un intento). El plazo de pared de `run.py`
        # (`--plazo`, abajo) sigue siendo quien corta un cuelgue de verdad.
        "HARNESS_CODER_TIMEOUT": "1500",
        # ⚠ Y por trozos, que es lo que hizo falta de verdad. Las dos corridas
        # del 20-sep murieron con HTTP 502 `upstream_unavailable` a los 5m17s y
        # 5m40s -la sonda corta contestaba en 5 s-: su pasarela no aguanta una
        # peticion sin streaming tanto rato, y quien corta es el otro extremo,
        # asi que subir el timeout no arregla nada. Ver `llm.STREAM`: cambia como
        # llegan los bytes, no lo que se pide.
        "HARNESS_CODER_STREAM": "1",
        # Precio-SOMBRA, no tarifa. Atria no publica precio y el proyecto paga
        # contra una cuota de tokens: coste marginal cero hasta agotarla. Pero
        # F-010 prohibe registrar 0 —no se distingue de una llamada gratis—, asi
        # que se usa la tarifa de su modelo base, GLM-5.2 en DeepInfra, que es la
        # que el plan original tenia para este mismo nodo (handoff del 1-jul-2026,
        # `Status_bearingworld.io a 1 de Julio de 2026.md` linea 90). Sin precio
        # de cache publicado: el hit se cobra como miss, la cifra conservadora.
        "DS_PRICE_IN_HIT": "1.20",
        "DS_PRICE_IN_MISS": "1.20",
        "DS_PRICE_OUT": "3.00",
        "HARNESS_PRICE_TABLE_DATE": "2026-07-01",
        "HARNESS_PRICE_NOTE": (
            "precio-SOMBRA: tarifa de GLM-5.2 en DeepInfra (1.20 in / 3.00 out USD "
            "por M; handoff 1-jul-2026). Atria no publica tarifa y se paga contra "
            "cuota de tokens: no es coste facturado (F-011)"),
    },
}


# Lo que cada brazo le pasa a `run.py` si quien lanza no lo dijo. El plazo de
# pared del brazo de Atria sube porque su `HARNESS_CODER_TIMEOUT` sube: un plazo
# por paso mas corto que el timeout de una sola llamada cortaria la corrida justo
# cuando el modelo todavia esta contestando dentro de lo previsto.
ARGS_POR_DEFECTO = {
    "deepseek": [],                 # el arnes tal cual: 1200 s, los de siempre
    "atria": ["--plazo", "2400"],
}


def _clave_de_usuario(nombre: str) -> str:
    """La clave del entorno de USUARIO de Windows, sin pasar por la consola.

    Un `setx` no llega a los procesos que ya estaban abiertos: la app que lanza
    esto arranco antes de que la clave existiera y su entorno no la tiene. Se lee
    del registro y se deja SOLO en el entorno de este proceso. Nunca se imprime
    (CLAUDE.md §10.1)."""
    if os.name != "nt":
        return ""
    import winreg
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as k:
            valor, _ = winreg.QueryValueEx(k, nombre)
    except OSError:
        return ""
    return str(valor or "").strip()


def preparar(brazo: str, necesita_clave: bool = True) -> dict:
    """Fija el entorno del brazo en ESTE proceso y devuelve lo que se fijo."""
    if brazo not in BRAZOS:
        raise SystemExit(f"brazo desconocido: {brazo!r}. Hay: {', '.join(BRAZOS)}")
    config = BRAZOS[brazo]

    if brazo == "deepseek":
        sobrantes = [v for v in VARIABLES if os.environ.get(v)]
        if sobrantes:
            raise SystemExit(
                "El brazo deepseek es el arnes TAL CUAL y el entorno trae "
                + ", ".join(sobrantes) + ". Una variable olvidada cambiaria en "
                "silencio la corrida que cuenta para la remedicion. Quitalas y relanza.")
    os.environ.update(config)

    nombre = config.get("HARNESS_CODER_KEY_ENV", "DEEPSEEK_API_KEY")
    if necesita_clave and not os.environ.get(nombre, "").strip():
        clave = _clave_de_usuario(nombre)
        if not clave:
            raise SystemExit(
                f"{nombre} no esta ni en el entorno de este proceso ni en el de "
                f"usuario de Windows. Definela tu (no la pegues en ningun fichero ni "
                f"en el chat):  setx {nombre} \"<clave>\"")
        os.environ[nombre] = clave
    return config


def _describir(brazo: str, config: dict) -> None:
    nombre = config.get("HARNESS_CODER_KEY_ENV", "DEEPSEEK_API_KEY")
    largo = len(os.environ.get(nombre, "").strip())
    print(f"· brazo {brazo}: " + (", ".join(
        f"{k}={v}" for k, v in config.items() if k != "HARNESS_PRICE_NOTE")
        or "el arnes tal cual, ninguna variable"))
    # La LONGITUD, no el valor (CLAUDE.md §10.1, F-038).
    print(f"· clave: {nombre}, {largo} caracteres" if largo else f"· clave: {nombre} sin definir")
    if config.get("HARNESS_PRICE_NOTE"):
        print(f"· {config['HARNESS_PRICE_NOTE']}")


def sonda() -> int:
    """Una llamada de prueba que ejercita lo que PUEDE ROMPER la corrida, no solo
    que la clave vale. Cuesta unos cientos de tokens de la cuota.

    Tres cosas, y las tres han estado a punto de costar una corrida:

      1. **El techo de `max_tokens` se pide ENTERO** (65536). Si el proveedor lo
         rechaza, se sabe aqui y no en el intento 1 con el prompt ya pagado.
      2. **Se mide la VELOCIDAD de salida** pidiendo unos cientos de tokens. De
         ahi sale si `HARNESS_CODER_TIMEOUT` aguanta una respuesta de ocho
         ficheros: si genera a 40 tokens/s, 25 000 tokens son 10 minutos, y un
         timeout de socket por debajo de eso REPITE la llamada pagando (F-119).
      3. **La forma de `usage`**, que es de donde sale el coste.
    """
    from ..core import llm
    print(f"· sonda: max_tokens={llm.DEFAULT_MAX_TOKENS if not llm.MAX_TOKENS_CAP else llm.MAX_TOKENS_CAP}"
          f", timeout {llm.TIMEOUT}s por operacion de socket"
          f", stream={'si' if llm.STREAM else 'no'}")
    t0 = time.time()
    data, secs = llm.call(
        [{"role": "user", "content":
          "Escribe una lista numerada del 1 al 120. Solo la lista."}],
        llm.MAX_TOKENS_CAP or llm.DEFAULT_MAX_TOKENS)
    choice = (data.get("choices") or [{}])[0]
    msg = choice.get("message") or {}
    usage = data.get("usage") or {}
    print(f"· responde en {secs:.1f}s (pared {time.time() - t0:.1f}s)")
    print(f"· modelo devuelto: {data.get('model')!r}")
    print(f"· finish_reason: {choice.get('finish_reason')!r}")
    print(f"· contenido: {(msg.get('content') or '')[:80]!r}")
    print(f"· trae reasoning_content: {bool(msg.get('reasoning_content'))}")
    print(f"· campos de usage: {sorted(usage)}")
    detalles = usage.get("prompt_tokens_details")
    if detalles is not None:
        print(f"· prompt_tokens_details: {detalles}")
    acc = llm.accumulate(usage, llm.new_acc())
    print(f"· contabilidad del arnes: {acc}")
    salida = acc["tokens_out"]
    if salida and secs > 0:
        vel = salida / secs
        print(f"· velocidad de salida: {vel:.0f} tokens/s")
        # Lo que de verdad decide si el timeout aguanta: cuanto tardaria una
        # respuesta del tamaño de la mayor medida en el proyecto (FORO-03,
        # 56 067 tokens de salida en un intento).
        peor = 56067 / vel
        print(f"· a esa velocidad, 56 067 tokens de salida (el peor intento "
              f"medido del proyecto) tardarian {peor / 60:.1f} min")
        if llm.STREAM:
            # Con trozos, el timeout acota cada LECTURA y no la llamada entera:
            # una respuesta larga no lo agota mientras sigan llegando bytes. Quien
            # tiene que caber es el plazo de pared del paso (`--plazo`).
            print(f"  → con stream eso no agota el timeout de socket ({llm.TIMEOUT / 60:.0f} min "
                  f"por lectura); quien tiene que caber es el plazo de pared del paso")
        elif peor > llm.TIMEOUT * 0.8:
            print(f"  ⚠ NO CABE en el timeout de socket ({llm.TIMEOUT / 60:.1f} min): "
                  f"subelo, o pide la respuesta por trozos")
        else:
            print(f"  → cabe en el timeout de socket ({llm.TIMEOUT / 60:.1f} min)")
    return 0


def main(argv=None) -> int:
    # La consola de Windows es cp1252 y lo primero que se imprime aqui ya lleva
    # `·`: sin esto sale `�`, o revienta al redirigir (ver `test_checks.main`).
    for flujo in (sys.stdout, sys.stderr):
        if hasattr(flujo, "reconfigure"):
            flujo.reconfigure(encoding="utf-8", errors="replace")
    argv = list(sys.argv[1:] if argv is None else argv)
    if not argv:
        raise SystemExit(__doc__)
    brazo, resto = argv[0], argv[1:]
    es_sonda = "--sonda" in resto
    config = preparar(brazo, necesita_clave="--seco" not in resto)
    _describir(brazo, config)
    if es_sonda:
        return sonda()

    # La corrida lleva el nombre del brazo salvo que lo diga quien lanza. Sin
    # esto las filas del experimento salen con `corrida = '-'` y, juntas en el
    # CSV, no se sabe cual midio a quien: dos brazos escriben las mismas
    # columnas para la misma pantalla el mismo dia.
    if "--seco" not in resto and not any(a == "--corrida" or a.startswith("--corrida=")
                                         for a in resto):
        resto += ["--corrida", f"brazo-{brazo}"]
    if not any(a == "--plazo" or a.startswith("--plazo=") for a in resto):
        resto += ARGS_POR_DEFECTO.get(brazo, [])

    from ..graph import run
    return run.main(resto)


if __name__ == "__main__":
    sys.exit(main())
