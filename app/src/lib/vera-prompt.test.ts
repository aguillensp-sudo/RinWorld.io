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

  // Filtros, búsqueda y acciones de fila de INV-01. Las etiquetas de los chips viven en lib/inventory.ts.
  const libInventario = readFileSync(resolve(process.cwd(), 'src/lib/inventory.ts'), 'utf8');
  const tabla = fuente('inventory/InventoryTable.tsx');

  it.each([
    ['Todos', libInventario],
    ['Publicados', libInventario],
    ['Desactualizados', libInventario],
    ['Archivados', libInventario],
    ['Buscar por referencia o marca', inventario],
    ['ti-archive', tabla],
    ['ti-trash', tabla],
  ])('Inventario: "%s" está en la pantalla y en la guía', (nombre, codigo) => {
    if (!nombre.startsWith('ti-')) expect(prompt).toContain(nombre);
    expect(codigo).toContain(nombre);
  });

  it('Inventario: archivar y eliminar no piden confirmación y la guía no lo disimula', () => {
    expect(prompt).toContain('Ninguno de los dos pide confirmación');
    expect(inventario).not.toMatch(/confirm\(|window\.confirm|role="dialog"/);
    expect(tabla).not.toMatch(/confirm\(|window\.confirm|role="dialog"/);
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

// VERA prepara consultas y ofertas (MSG-03 §5, F-249). Dos cosas se vigilan aquí: que lo que la guía
// dice de los formularios siga siendo cierto, y que las TRES reglas que impiden inventar una cifra de
// dinero sigan escritas en el prompt. El texto exacto de la regla del precio es lo que, si alguien lo
// «mejora» sin mirar, abre el riesgo #1 con dinero de por medio.
describe('VERA · prepara consultas y ofertas sin inventar', () => {
  const src = (rel: string) => readFileSync(resolve(process.cwd(), 'src/screens', rel), 'utf8');
  const pie = src('messages/ThreadComposer.tsx');
  const selector = src('messages/InquiryLinePicker.tsx');
  const oferta = src('messages/OfferCounterForm.tsx');
  const resultados = src('search/SearchResults.tsx');
  const tabla = src('search/ResultsTable.tsx');
  const textosForm = readFileSync(resolve(process.cwd(), 'src/lib/inquiry-form.ts'), 'utf8');

  it.each([
    ['Crear consulta', textosForm],
    ['Buscar por referencia o marca', textosForm],
    ['Consulta pendiente', textosForm],
    ['Nueva tarjeta de consulta', textosForm],
    ['Cantidad solicitada', textosForm],
    ['Notas adicionales', textosForm],
    ['Enviar consulta', textosForm],
    ['Cancelar', textosForm],
    ['Crear oferta', pie],
    ['Precio unitario', oferta],
    ['Divisa', oferta],
    ['Plazo de entrega (días)', oferta],
    ['Coste de transporte', oferta],
    ['Válida hasta', oferta],
    ['Enviar oferta', pie],
    ['Consultar seleccionados', resultados],
    ['Consultar', tabla],
  ])('"%s" está en la pantalla y en la guía', (nombre, codigo) => {
    expect(prompt).toContain(nombre);
    expect(codigo).toContain(nombre);
  });

  it('el selector y el formulario hacen lo que la guía dice (buscar con Intro, máximo 300, cola de formularios)', () => {
    expect(selector).toContain('SearchField');
    expect(textosForm).toContain('Máx 300 caracteres');
    expect(prompt).toContain('máximo 300 caracteres');
    expect(prompt).toContain('abre un formulario por cada fila marcada, uno detrás de otro');
  });

  it('las tres reglas siguen escritas: solo cifras del usuario, el precio nunca, y nunca «enviado»', () => {
    expect(prompt).toContain('PREPARAR CONSULTAS Y OFERTAS: TÚ PREPARAS, EL USUARIO REVISA Y ENVÍA');
    expect(prompt).toContain('Solo las cifras que el usuario ha escrito en esta conversación');
    expect(prompt).toContain('no pongas una tuya ni la que haya en stock');
    expect(prompt).toContain('EL PRECIO NO SE RELLENA NUNCA');
    expect(prompt).toContain('repítelo en tu respuesta para que lo teclee él');
    expect(prompt).toContain('Nunca digas que has enviado algo');
    expect(prompt).toContain('no lo afirmes');
  });

  it('dice que solo prepara, que no envía, y que sin hilo abierto no las llame', () => {
    expect(prompt).toContain('NO ENVÍAN NADA');
    expect(prompt).toContain('- Enviar nada: ni consultas, ni ofertas, ni mensajes.');
    expect(prompt).toContain('Sin hilo abierto no las llames');
  });

  it('el contexto del hilo abierto recuerda las dos herramientas y que las envía el usuario', () => {
    expect(prompt).toContain('preparar_consulta y preparar_oferta; las envía el usuario');
  });

  it('las dos herramientas están declaradas y la de oferta repite la regla del precio en su descripción', () => {
    expect(tools).toContain('"name": "preparar_consulta"');
    expect(tools).toContain('"name": "preparar_oferta"');
    expect(tools).toContain('EL PRECIO NO SE RELLENA NUNCA');
  });
});
