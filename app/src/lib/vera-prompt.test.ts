import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * El prompt de VERA vive en una Edge Function (Deno) y no se puede importar desde aquí; se lee
 * como texto. No prueba qué responde el modelo —eso solo lo prueba una llamada real—, prueba que
 * las reglas que cerraron un fallo siguen escritas.
 *
 * INV-01 (10-oct-2026): VERA contestó «pulsa el botón de nueva línea (normalmente un +)» en una
 * pantalla que no tiene ese botón. El prompt tenía la regla primera para los DATOS y nada para la
 * INTERFAZ, de la que VERA solo conoce el nombre de la pantalla.
 */
const prompt = readFileSync(resolve(process.cwd(), '../supabase/functions/vera/index.ts'), 'utf8');
const tools = readFileSync(resolve(process.cwd(), '../supabase/functions/vera/tools.json'), 'utf8');

describe('VERA · no inventa la interfaz', () => {
  it('el prompt dice que no conoce los controles de la pantalla y prohíbe describirlos', () => {
    expect(prompt).toContain('LA INTERFAZ DE LA APLICACIÓN NO LA CONOCES');
    expect(prompt).toContain('NUNCA expliques cómo se hace algo en la interfaz');
  });

  it('el contexto dinámico recuerda que solo sabe el nombre de la pantalla', () => {
    expect(prompt).toContain('solo sabes su nombre');
  });

  it('no afirma que solo existan cinco pantallas (Empresas y Foros ya están construidas)', () => {
    expect(prompt).not.toContain('Solo hay cinco construidas');
    expect(tools).not.toContain('únicas pantallas que existen');
    expect(tools).not.toContain('NO están construidas');
  });
});

// La GUÍA VERIFICADA del prompt solo vale mientras lo que dice siga en la pantalla. Cada nombre que cita
// tiene que aparecer, literal, en el código de la pantalla de la que habla: si alguien renombra un
// botón, este test obliga a actualizar la guía en el mismo cambio (la causa de F-246 fue
// justo una afirmación sobre la interfaz que dejó de ser cierta).
describe('VERA · la guía verificada sigue siendo cierta', () => {
  const fuente = (rel: string) => readFileSync(resolve(process.cwd(), 'src/screens', rel), 'utf8');
  const inventario = fuente('inventory/Inventory.tsx');
  const mapeo = fuente('inventory/ImportMapping.tsx');

  it.each([
    ['Subir nuevo inventario', inventario],
    ['Arrastra tu archivo aquí', inventario],
    ['Subida manual', inventario],
    ['Canal email', inventario],
    ['Próximamente', inventario],
    ['Acumulativo', mapeo],
    ['Reemplazo total', mapeo],
    ['Confirmar e ', mapeo],
  ])('"%s" está en la pantalla y en la guía', (nombre, codigo) => {
    expect(prompt).toContain(nombre);
    expect(codigo).toContain(nombre);
  });

  // Visibilidad (INV-07). Los textos de los modos viven en lib/visibility.ts, no en la pantalla.
  const visibilidad = fuente('inventory/Visibility.tsx');
  const panel = fuente('inventory/ExclusionPanel.tsx');
  const libVisibilidad = readFileSync(resolve(process.cwd(), 'src/lib/visibility.ts'), 'utf8');

  it.each([
    ['Visibilidad', inventario],
    ['Visibilidad del inventario', visibilidad],
    ['Guardar configuración', visibilidad],
    ['Lista de exclusión', visibilidad],
    ['Visible para todos los miembros', libVisibilidad],
    ['Visibilidad restringida', libVisibilidad],
    ['Buscar organización por nombre', panel],
    ['Excluir por continente', panel],
    ['Refinar por país', panel],
    ['Añadir exclusión geográfica', panel],
  ])('Visibilidad: "%s" está en la pantalla y en la guía', (nombre, codigo) => {
    expect(prompt).toContain(nombre);
    expect(codigo).toContain(nombre);
  });

  // El resto de lo que la guía afirma de Visibilidad lo fija Visibility.test.tsx: el modo solo se guarda
  // con «Guardar configuración», las exclusiones se escriben al momento, la lista se conserva en modo
  // abierto y un EDITOR solo lee. Aquí solo se comprueba que la regla de permisos sigue siendo «ADMIN».
  it('Visibilidad: solo el administrador gestiona, como dice la guía', () => {
    expect(libVisibilidad).toMatch(/role === 'ADMIN'/);
    expect(prompt).toContain('Solo un administrador de la organización puede cambiar esto');
  });

  it('no promete añadir una línea a mano ni un botón que no existe', () => {
    expect(prompt).toContain('Añadir una línea suelta a mano no es posible');
    expect(inventario).not.toMatch(/Nueva línea|Añadir línea/);
  });
});
