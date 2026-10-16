# Día 41 · 15-oct-2026

Una sola sesión, la de VERA.

## B2: el filtro quitado a mano, en la herramienta

El PO aprobó la propuesta del cierre del día 40 («procede a hacerlo»): si VERA vuelve a poner un filtro que el
usuario quitó o cambió a mano en Comprando, `buscar_en_catalogo` no busca ni mueve la pantalla y le pide repetir
sin él, o con `confirmar_filtros_quitados` si el usuario lo ha pedido en su último mensaje (`f3de9cb`, función v40).

Contra Sonnet 5: B2 3 de 3 (en dos, el control lo paró y VERA repitió sin la zona, diciéndolo); B9, el caso opuesto
(«vuelve a ponerme Europa y añade FAG»), 2 de 2. `F-101` se cierra; `F-258` queda abierto solo por B7.

## El PO empieza a probar a mano

Pidió un plan de pruebas para hacerlo él y preguntó cuál es el proyecto Supabase: `troxminloxkjwihwfevs`, que es
producción; no hay entorno de desarrollo propio para VERA (`bearingworld-e2e` no tiene la función `vera`).

## Lecciones

- **Cuando una instrucción en el contexto no basta tres veces, el siguiente paso es código, no otra instrucción.**
  B2 falló 4 de 4 con la frase y con el aviso explícito; con el control determinista, 3 de 3. El modelo decide
  igual de mal, pero ahora no puede hacerlo en silencio.
