# SP-1 · ¿Sirve DeepSeek-V4-Flash como Coder?

**Material de evaluación, NO código del MVP.** Este directorio es el spike del día 1:
mide la calidad de `deepseek-v4-flash` (DeepSeek oficial) convirtiendo el HTML aprobado
de INV-01 en un componente React `InventoryTable.tsx`. Se conserva como evidencia de la
puerta de decisión, no se reutiliza en producción.

> Nota de contexto: el plan original preveía **GLM-5.2 vía DeepInfra**. Se cambió de
> proveedor a **DeepSeek oficial** (`deepseek-v4-flash`) por coste. Ver findings-register
> (clasificación `INFRA`).

## Estructura

- `run_deepseek.py` — llamada directa a DeepSeek (sin LangGraph). Lee la clave de
  `os.environ["DEEPSEEK_API_KEY"]`. Genera `src/InventoryTable.tsx` + `.module.css`.
- `src/main.tsx` — host de render con datos de ejemplo (para la comparación visual C2).
- `metrics/attempt_<n>.json` — tokens, coste y timing por intento.
- Proyecto Vite mínimo para `tsc --noEmit` (C1) y render (C2).

## Cómo se ejecuta

```powershell
$env:PYTHONUTF8="1"
$env:DEEPSEEK_API_KEY = [Environment]::GetEnvironmentVariable('DEEPSEEK_API_KEY','User')
python run_deepseek.py 1            # intento 1
npm run typecheck                  # C1
npm run dev                        # C2 (render en navegador)
```

## Rúbrica (5 criterios, ≥3 para aprobar)

- C1 Compila (`tsc --noEmit`)
- C2 Renderiza reconocible vs. HTML aprobado
- C3 Usa tokens del design system, no valores inventados
- C4 React idiomático (sin `dangerouslySetInnerHTML`, props tipadas)
- C5 ¿Lo mantendrías? (juicio del PO)
