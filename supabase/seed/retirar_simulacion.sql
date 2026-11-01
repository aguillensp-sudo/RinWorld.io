-- Retira lo que crea supabase/seed/poblar-simulacion.mjs, y solo eso.
--
-- Todo lo simulado lleva un id con prefijo 5eed000N- (miembros 1, líneas 2, hilos 3, elementos 4).
-- Orden: elementos y hilos (las claves envueltas se van por on delete cascade), líneas, miembros
-- y, al final, las cuentas de auth (los miembros caen solos por members_id_fkey).
--
-- Se ejecuta por el MCP de Supabase (CLAUDE.md §10.2), nunca por la CLI.

delete from public.thread_items where id::text like '5eed0004-%';
delete from public.threads where id::text like '5eed0003-%';
delete from public.inventory_lines where id::text like '5eed0002-%';
delete from public.members where id::text like '5eed0001-%';
delete from auth.users where id::text like '5eed0001-%';
