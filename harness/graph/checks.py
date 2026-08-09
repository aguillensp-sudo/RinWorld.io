"""Los checks que no necesitan subproceso: C3 (paleta) y C4 (React idiomatico).

Son funciones puras sobre el texto que devolvio el Coder, para que se puedan
probar sin arrancar npm y sin gastar un token.

**C3 se valida contra §1.1 + §1.4 + §1.5 de `design-system.md`, nunca contra §1.1
a secas** (F-003). Los tres bloques estan materializados en
`app/src/styles/tokens.css`, que es de donde se lee aqui: F-003 dice literalmente
que la accion fue publicarlos alli. Validar contra §1.1 sola **rechazaria output
correcto** — el `#ef4444` de SP-1 no era un desvio, es `.age.danger` del HTML
aprobado, un rol distinto del `#DC2626` de error.

Ojo con el otro check de paleta: `app/scripts/check-palette.mjs` mira si el
**sistema de diseno esta completo**; este mira el **output del Coder**. Son las dos
mitades del mismo problema y aquel tiene que estar verde para que este sea justo.
"""
import re

# Cualquier color literal escrito a mano. `var(--bw-…)` no casa con ninguno.
HEX = re.compile(r"#[0-9a-fA-F]{3,8}\b")
RGB = re.compile(r"\brgba?\s*\(\s*\d")

COMMENT_CSS = re.compile(r"/\*.*?\*/", re.S)
COMMENT_LINE = re.compile(r"(?m)^\s*//.*$")

FORBIDDEN = [
    (re.compile(r"dangerouslySetInnerHTML"),
     "dangerouslySetInnerHTML: prohibido sin excepcion"),
    (re.compile(r":\s*any\b|\bas\s+any\b|<any>"),
     "tipo `any`: las props y el estado van tipados"),
    (re.compile(r"@ts-(ignore|nocheck|expect-error)"),
     "supresion de TypeScript: si no compila, no pasa C1"),
]

NODE_BUILTINS = {"node:fs", "node:path", "node:url", "fs", "path", "url"}

#: Componente = funcion con nombre en mayuscula. Si recibe parametros, van tipados.
COMPONENT_FN = re.compile(
    r"(?:export\s+)?(?:default\s+)?function\s+([A-Z]\w*)\s*\(([^)]*)\)"
    r"|const\s+([A-Z]\w*)\s*(?::[^=]+)?=\s*\(([^)]*)\)\s*(?::[^=]+)?=>"
)


def _strip_comments(text: str) -> str:
    return COMMENT_LINE.sub("", COMMENT_CSS.sub("", text))


def check_palette(files: dict, tokens: dict) -> dict:
    """C3. Un color literal es rojo aunque el valor sea correcto: el criterio es
    'usa tokens, no valores inventados', y `#2563EB` a pelo incumple igual que un
    hex inventado. Cuando el valor coincide con un token, el detalle dice cual —
    ese es el feedback util para el reintento."""
    by_value = {v.lower(): k for k, v in tokens.items()}
    offenders = []
    for name, content in sorted(files.items()):
        if not re.search(r"\.(css|tsx|ts)$", name):
            continue
        clean = _strip_comments(content)
        for line_no, line in enumerate(clean.split("\n"), 1):
            for m in HEX.finditer(line):
                value = m.group(0).lower()
                token = by_value.get(value)
                hint = f" -> usa var({token})" if token else " -> no esta en tokens.css"
                offenders.append(f"{name}:{line_no} color literal {m.group(0)}{hint}")
            if RGB.search(line):
                offenders.append(
                    f"{name}:{line_no} color literal rgb()/rgba() -> usa un token")

    ok = not offenders
    detail = "sin colores literales" if ok else "\n".join(offenders)
    return {"id": "C3", "ok": ok, "detail": detail}


def check_idiomatic(files: dict, allowed_outputs: list, dependencies: set) -> dict:
    """C4. Reglas mecanicas, ningun juicio. Cuatro familias: patrones prohibidos,
    props sin tipar, dependencias nuevas y ficheros fuera de los declarados."""
    problems = []
    allowed = set(allowed_outputs)

    for name in sorted(files):
        if name not in allowed:
            problems.append(
                f"{name}: fichero no declarado en `outputs` de la tarea. El Coder no "
                f"escribe donde no se le pidio (y el shell no se toca)")

    for name, content in sorted(files.items()):
        clean = _strip_comments(content)

        for pattern, message in FORBIDDEN:
            for line_no, line in enumerate(clean.split("\n"), 1):
                if pattern.search(line):
                    problems.append(f"{name}:{line_no} {message}")

        for m in re.finditer(r"""(?:import[^'"]*|from\s*)['"]([^'"]+)['"]""", clean):
            mod = m.group(1)
            if mod.startswith(".") or mod.startswith("/"):
                continue
            root = mod if mod.startswith("@") and mod.count("/") < 2 else mod.split("/")[0]
            if mod.startswith("@"):
                root = "/".join(mod.split("/")[:2])
            if root in dependencies or root in NODE_BUILTINS:
                continue
            problems.append(
                f"{name}: dependencia nueva `{root}`. Solo lo que ya esta en "
                f"package.json")

        if name.endswith(".tsx"):
            for m in COMPONENT_FN.finditer(clean):
                params = (m.group(2) or m.group(4) or "").strip()
                comp = m.group(1) or m.group(3)
                if params and ":" not in params:
                    problems.append(
                        f"{name}: `{comp}` recibe props sin tipar ({params})")

    ok = not problems
    detail = "reglas mecanicas en verde" if ok else "\n".join(problems)
    return {"id": "C4", "ok": ok, "detail": detail}


TOKEN_DECL = re.compile(r"^\s*(--[\w-]+)\s*:\s*([^;]+);", re.M)


def read_tokens(tokens_css: str) -> dict:
    """`{--nombre: valor}` de los tokens que son un color literal. Los que apuntan
    a otro token (`var(...)`) no aportan valor nuevo y se omiten."""
    out = {}
    for name, value in TOKEN_DECL.findall(tokens_css):
        value = value.strip()
        if value.startswith("var("):
            continue
        out[name] = value
    return out
