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

  // 14-oct-2026, decisión del PO: navegar lleva también a Empresas y Foros.
  it('el prompt y tools.json dicen que navegar abre siete pantallas, a su entrada, y que Contacto no existe', () => {
    expect(prompt).toContain('una de las siete que acepta la herramienta navegar (Panel, Vendiendo, Comprando, Hilos, Inventario, Empresas, Foros)');
    expect(prompt).toContain('el Directorio en Empresas y la lista de categorías en Foros');
    expect(prompt).not.toContain('una de las cinco que acepta la herramienta navegar');
    expect(tools).not.toContain('esta herramienta no puede abrirlas');
    expect(tools).toContain("'Contacto' está en el menú pero todavía no existe");
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
  const ingesta = fuente('inventory/IngestChannel.tsx');

  it.each([
    ['Subir nuevo inventario', inventario],
    ['Arrastra tu archivo aquí', inventario],
    ['Subida manual', inventario],
    ['Canal email', inventario],
    ['Gestionar canal email', inventario],
    ['Rotar dirección', ingesta],
    ['+ Añadir remitente', ingesta],
    ['Canal de ingestión por email', ingesta],
    ['Copiar', ingesta],
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

// La guía de Vendiendo, el resto de Comprando e Hilos (12-oct-2026). Mismo mecanismo que arriba: cada
// nombre que la guía cita ENTRE COMILLAS tiene que estar, literal, en el código de la pantalla de la que
// habla. Aquí además se comprueba el entrecomillado en el prompt (un nombre suelto dentro de una frase no
// prueba que VERA lo cite tal cual), y las afirmaciones de estructura (qué botón depende de qué estado,
// qué acción no pide confirmación, qué botón está apagado) se atan al código que las decide. Si alguien
// cambia una de ellas, este test obliga a actualizar la guía en el mismo cambio.
describe('VERA · la guía de Vendiendo, Comprando e Hilos sigue siendo cierta', () => {
  const screen = (rel: string) => readFileSync(resolve(process.cwd(), 'src/screens', rel), 'utf8');
  const lib = (rel: string) => readFileSync(resolve(process.cwd(), 'src/lib', rel), 'utf8');

  const ofertasEnviadas = screen('selling/SentOffers.tsx') + screen('selling/SentOffersTable.tsx');
  const libOfertasEnviadas = lib('sent-offers.ts');
  const resultados = screen('search/SearchResults.tsx');
  const tablaResultados = screen('search/ResultsTable.tsx');
  const chips = screen('search/FilterChips.tsx');
  const libBusqueda = lib('search.ts');
  const lotes = screen('search/BatchSearch.tsx');
  const tarjetaLote = screen('search/BatchCard.tsx');
  const libLotes = lib('batch.ts');
  const watchers = screen('search/Watchers.tsx');
  const tarjetaWatcher = screen('search/WatcherCard.tsx');
  const formWatcher = screen('search/WatcherEditForm.tsx');
  const borrarWatcher = screen('search/DeleteWatcherModal.tsx');
  const libWatchers = lib('watchers.ts');
  const lista = screen('messages/Messages.tsx');
  const hilo = screen('messages/Thread.tsx');
  const cabecera = screen('messages/ThreadHeader.tsx');
  const historial = screen('messages/ThreadHistory.tsx');
  const pie = screen('messages/ThreadComposer.tsx');
  const formOferta = screen('messages/OfferCounterForm.tsx');
  const tablas = lib('negotiation-tables.ts');
  const libOfertas = lib('offers.ts');
  const libHilo = lib('thread-detail.ts');
  const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

  it.each([
    // Vendiendo
    ['Mis ofertas', libOfertasEnviadas],
    ['Referencia', ofertasEnviadas],
    ['Organización', ofertasEnviadas],
    ['Estado', ofertasEnviadas],
    ['Fecha', ofertasEnviadas],
    ['Acciones', ofertasEnviadas],
    ['Buscar por referencia u organización…', libOfertasEnviadas],
    ['Ver acuerdo', libOfertasEnviadas],
    ['Ver hilo', libOfertasEnviadas],
    // Comprando: resultados
    ['Resultados de búsqueda', resultados],
    ['Ref', libBusqueda],
    ['Marca', libBusqueda],
    ['Qty mín', libBusqueda],
    ['Zona', libBusqueda],
    ['Lead time máx', libBusqueda],
    ['Filtro', chips],
    // F-229 (14-oct): al elegir Zona en «Filtro» sale además el país, y con solo país el chip se llama País.
    ['País (opcional)', chips],
    ['Añadir', chips],
    ['Seleccionar todos', resultados],
    ['Deseleccionar todos', resultados],
    ['Cantidad', tablaResultados],
    ['Plazo', tablaResultados],
    ['Empresa', tablaResultados],
    ['País', tablaResultados],
    ['Antigüedad', tablaResultados],
    ['Favoritos', tablaResultados],
    ['Contactar', tablaResultados],
    ['Búsqueda por lotes', resultados],
    ['Mis watchers', resultados],
    // Comprando: búsqueda por lotes
    ['Búsqueda por lotes', lotes],
    ['Lista de referencias', lotes],
    ['Buscar', lotes],
    ['Continuar con las primeras 50', lotes],
    ['Dividir en tandas', lotes],
    ['Procesar la siguiente tanda', lotes],
    ['Exportar resumen', lotes],
    ['Sin resultados', libLotes],
    ['No se pudo consultar', libLotes],
    // Comprando: watchers
    ['Mis watchers', watchers],
    ['Todos', libWatchers],
    ['Activos', libWatchers],
    ['Pausados', libWatchers],
    ['Disparados', libWatchers],
    ['Pendientes de renovación', libWatchers],
    ['Expirados', libWatchers],
    ['In-app', tarjetaWatcher],
    ['Email', tarjetaWatcher],
    ['Pausar', tarjetaWatcher],
    ['Reactivar', tarjetaWatcher],
    ['Editar', tarjetaWatcher],
    ['Eliminar', tarjetaWatcher],
    ['Ver resultados', tarjetaWatcher],
    ['Mantener activo 30 días más', tarjetaWatcher],
    ['Dejar que expire', tarjetaWatcher],
    ['Cantidad mínima', formWatcher],
    ['País', formWatcher],
    ['Canal email', formWatcher],
    ['Guardar cambios', formWatcher],
    ['Crear watcher con estos criterios', resultados],
    ['Crear watchers para referencias sin stock', lotes],
    ['Crear watcher', tarjetaLote],
    // Hilos: la lista
    ['Buscar por nombre de organización...', lista],
    ['Nuevo contacto', lista],
    ['Limpiar búsqueda', lista],
    ['Página anterior', lista],
    ['Página siguiente', lista],
    // Hilos: un hilo abierto
    ['Hilos', cabecera],
    ['Acciones del hilo', cabecera],
    ['Marcar acuerdo alcanzado', cabecera],
    ['Cerrar sin acuerdo', cabecera],
    ['Revertir a abierto', cabecera],
    ['El acuerdo se alcanza aceptando una oferta.', libHilo],
    ['¿Cerrar sin acuerdo?', hilo],
    ['Cancelar', hilo],
    ['Confirmar', hilo],
    ['Ver lo que ve el servidor', historial],
    ['Consultas', tablas],
    ['Ofertas', tablas],
    ['Cifrado', tablas],
    ['—', tablas],
    ['Responder con oferta', tablas],
    ['Sin stock', tablas],
    ['Aceptar', tablas],
    ['Aceptar igualmente', tablas],
    ['Contra-ofertar', tablas],
    ['Rechazar', tablas],
    ['Enviar oferta', historial],
    ['Contra-oferta', formOferta],
    ['Enviar contraoferta', formOferta],
    ['Escribe un mensaje...', pie],
    ['Enviar mensaje', pie],
    ['Cifrado E2EE antes del envío', pie],
  ])('"%s" está en la pantalla y entrecomillado en la guía', (nombre, codigo) => {
    expect(prompt).toContain(`"${nombre}"`);
    expect(codigo).toContain(nombre);
  });

  // Estados citados sin comillas, tal como los pinta cada pantalla.
  it.each([
    ['Pendiente', ofertasEnviadas],
    ['Aceptada', ofertasEnviadas],
    ['Rechazada', ofertasEnviadas],
    ['Superada por contraoferta', ofertasEnviadas],
    ['ACTIVE', libWatchers],
    ['PAUSED', libWatchers],
    ['TRIGGERED', libWatchers],
    ['PENDIENTE RENOVACIÓN', libWatchers],
    ['EXPIRED', libWatchers],
    ['PENDIENTE', tablas],
    ['RESPONDIDA', tablas],
    ['SIN STOCK', tablas],
    ['ACEPTADA', tablas],
    ['RECHAZADA', tablas],
    ['SUPERADA', tablas],
    ['EXPIRADA', tablas],
    ['CERRADO SIN ACUERDO', libOfertas],
    ['ACUERDO ALCANZADO', libOfertas],
  ])('el estado %s está en la pantalla y en la guía', (nombre, codigo) => {
    expect(prompt).toContain(nombre);
    expect(codigo).toContain(nombre);
  });

  // Textos que la guía cita con un número o un recuento en medio: el patrón vive en una función, no en un literal.
  it('los textos con cifras de la guía salen de las plantillas de la pantalla', () => {
    expect(prompt).toContain('"N / 50 referencias"');
    expect(libLotes).toContain('/ ${MAX_BATCH} referencias');
    expect(libLotes).toMatch(/MAX_BATCH = 50/);
    expect(prompt).toContain('"Quedan N referencias por procesar."');
    expect(lotes).toContain("'Quedan ' + pending.length + ' referencias por procesar.'");
    expect(prompt).toContain('"Distribuidores: N · Máx: X u (marca, país)"');
    expect(libLotes).toContain('Distribuidores: ${s.distributors} · Máx: ${quantityLabel(s.maxQuantity)} u (${s.maxBrand}, ${s.maxCountry})');
    expect(prompt).toContain('"N referencias · X con stock · Y sin resultados"');
    expect(libLotes).toContain('con stock · ${sin} sin resultados');
    expect(prompt).toContain('"N / 50 watchers activos"');
    expect(libWatchers).toMatch(/WATCHER_LIMIT = 50/);
    expect(libWatchers).toContain('${activeWatcherCount(rows)} / ${WATCHER_LIMIT} watchers activos');
    expect(libBusqueda).toContain('con stock ≥');
    expect(resultados).toContain('Mostrando los primeros 200 resultados');
    expect(libBusqueda).toMatch(/MAX_RESULTS = 200/);
  });

  // Vendiendo: una sola acción por fila, y ninguna de las que la guía dice que no existen.
  it('Vendiendo: "Ver acuerdo" solo con la oferta Aceptada, y no hay retirar, renovar ni editar', () => {
    expect(libOfertasEnviadas).toMatch(/state === 'Aceptada' \? 'Ver acuerdo' : 'Ver hilo'/);
    expect(ofertasEnviadas).not.toMatch(/Retirar|Renovar|Editar/);
    expect(ofertasEnviadas).not.toMatch(/content_ciphertext|decryptItem/);
  });

  it('Vendiendo, Comprando y Hilos: los botones llevan a donde la guía dice', () => {
    expect(app).toMatch(/<SentOffers[\s\S]{0,200}setNav\(MESSAGES_NAV\);[\s\S]{0,60}setOpenThreadId\(threadId\)/);
    expect(app).toMatch(/onOpenDirectory=\{\(\) => \{[\s\S]{0,120}setNav\(EMPRESAS_NAV\)/);
    expect(app).toMatch(/const contactFromSearch[\s\S]{0,700}setNav\(MESSAGES_NAV\)[\s\S]{0,300}setNav\(EMPRESAS_NAV\)/);
    expect(app).toMatch(/onViewResults=\{\(criteria\) => \{[\s\S]{0,80}setVeraCriteria\(criteria\)/);
  });

  // Comprando: lo que ordena, y lo que la guía dice que no hace nada.
  it('Comprando: las seis cabeceras que ordenan son las que la guía nombra', () => {
    for (const [etiqueta, clave] of [
      ['Marca', 'brand'],
      ['Cantidad', 'quantity'],
      ['Plazo', 'leadTime'],
      ['País', 'country'],
      ['Antigüedad', 'age'],
      ['Favoritos', 'favorites'],
    ]) {
      expect(tablaResultados).toContain(`{ label: '${etiqueta}', key: '${clave}', sortable: true }`);
    }
    for (const etiqueta of ['Referencia', 'Empresa']) {
      expect(tablaResultados).toContain(`{ label: '${etiqueta}', sortable: false }`);
    }
  });

  it('Lotes: no hay "Consultar seleccionados" y "Consultar" de las filas no abre nada, "Buscar" se apaga al pasar de 50', () => {
    expect(lotes).toMatch(/const handleConsult = useCallback\(\(_lineId: string\) => \{\}, \[\]\);/);
    expect(lotes).not.toMatch(/>\s*Consultar seleccionados\s*</);
    expect(lotes).toMatch(/disabled=\{refs\.length === 0 \|\| overLimit \|\| loading\}/);
    expect(lotes).toMatch(/const handleFirstFifty[\s\S]{0,160}runSearch\(primeras, \[\]\)/);
    expect(lotes).toMatch(/const handleSplit[\s\S]{0,160}runSearch\(primeras, rest\)/);
    expect(libLotes).toMatch(/split\(\/\[\\r\\n,;\\t\]\+\/\)/);
    expect(lotes).toContain("type: 'text/csv'");
  });

  // Watchers: qué botón sale en qué estado, y que crear uno no se puede desde la interfaz.
  it('Watchers: los botones de cada tarjeta dependen del estado como dice la guía', () => {
    expect(tarjetaWatcher).toMatch(/\{isTriggered && \(\s*<button[\s\S]*?Ver resultados/);
    expect(tarjetaWatcher).toMatch(/\{isRenewal && \(\s*<>[\s\S]*?Mantener activo 30 días más[\s\S]*?Dejar que expire/);
    expect(tarjetaWatcher).toMatch(/\{isActive && \(\s*<button[\s\S]*?Pausar/);
    expect(tarjetaWatcher).toMatch(/\{isPaused && \(\s*<button[\s\S]*?Reactivar/);
    expect(tarjetaWatcher).toMatch(/\{\(isActive \|\| isPaused\) && \(\s*<button[\s\S]*?Editar/);
    // Eliminar es el único botón fuera de toda condición, y EXPIRED no tiene ninguna condición propia.
    expect(tarjetaWatcher).not.toMatch(/isExpired|state === 'EXPIRED'/);
    expect(tarjetaWatcher).toMatch(/\)\}\s*<button[^>]*\s*type="button"[\s\S]{0,200}onClick=\{\(\) => onDelete\(row\)\}/);
    expect(formWatcher).toContain('Referencia');
    expect(formWatcher).toContain('Marca');
    expect(borrarWatcher).toContain('Esta acción no se puede deshacer');
    expect(watchers).toContain('<DeleteWatcherModal');
  });

  it('Watchers: crear uno no es posible desde la interfaz, como dice la guía', () => {
    expect(resultados).toMatch(/disabled[\s\S]{0,400}Crear watcher con estos criterios/);
    expect(lotes).toMatch(/disabled\s*title="[^"]*"\s*>\s*Crear watchers para referencias sin stock/);
    expect(tarjetaLote).toMatch(/disabled[\s\S]{0,400}Crear watcher\s*<\/button>/);
    expect(libWatchers).not.toMatch(/createWatcher|\.insert\(/);
  });

  // Hilos: la cabecera, el cierre, la reversión y las acciones sobre consultas y ofertas.
  it('Hilos: "Marcar acuerdo alcanzado" siempre apagado; cerrar y revertir dependen del estado', () => {
    expect(cabecera).toMatch(/<button type="button" className=\{styles\.actionButton\} disabled>\s*Marcar acuerdo alcanzado/);
    expect(libOfertas).toMatch(/canCloseThread\(state: ThreadState\): boolean \{\s*return state !== 'CERRADO SIN ACUERDO';/);
    expect(libOfertas).toMatch(/canRevertAgreement\(state: ThreadState\): boolean \{\s*return state === 'ACUERDO ALCANZADO';/);
  });

  it('Hilos: cerrar pide confirmación; revertir, aceptar, rechazar y "Sin stock" actúan al pulsar', () => {
    expect(hilo).toMatch(/const handleClose = useCallback\(\(\) => \{\s*setConfirmOpen\(true\);/);
    const bloque = (nombre: string) => hilo.match(new RegExp(`const ${nombre} = useCallback\\([\\s\\S]*?\\],?\\s*\\);`))?.[0] ?? '';
    for (const [nombre, escritura] of [
      ['handleRevert', 'revertAgreement'],
      ['handleAcceptOffer', 'acceptOffer'],
      ['handleRejectOffer', 'rejectOffer'],
      ['handleOutOfStock', 'markOutOfStock'],
    ]) {
      const cuerpo = bloque(nombre as string);
      expect(cuerpo).toContain(escritura);
      expect(cuerpo).not.toContain('setConfirmOpen');
    }
  });

  it('Hilos: quién ve qué botón en las tablas (solo el receptor, solo Pendiente; expirada cambia Aceptar)', () => {
    expect(libOfertas).toMatch(/if \(offer\.state !== 'Pendiente'\) return \[\];\s*if \(offer\.senderOrgId === viewerOrgId\) return \[\];\s*return \['aceptar', 'rechazar', 'contraofertar'\];/);
    expect(tablas).toMatch(/const decide = !item\.isOwn && state === 'Pendiente';/);
    expect(tablas).toContain("actions: decide ? ['responder', 'sin-stock'] : [],");
    expect(tablas).toContain("actions.push(expired ? 'aceptar-igualmente' : 'aceptar')");
    expect(tablas).toMatch(/base\.includes\('contraofertar'\) && !expired/);
    expect(tablas).toContain('counterDisabledReason');
    expect(historial).toContain('title="Responder con oferta"');
    expect(formOferta).toContain("title = 'Contra-oferta'");
    expect(formOferta).toContain('Datos de la oferta original, pre-rellenados.');
  });

  it('Hilos: el campo de mensaje envía con Intro y salta de línea con Alt o Mayús', () => {
    expect(pie).toMatch(/if \(e\.key !== 'Enter' \|\| e\.nativeEvent\.isComposing\) return;/);
    expect(pie).toMatch(/if \(e\.altKey \|\| e\.shiftKey\)/);
  });
});

describe('VERA · la guía de Empresas, Foro, Panel y Configuración sigue siendo cierta', () => {
  const screen = (rel: string) => readFileSync(resolve(process.cwd(), 'src/screens', rel), 'utf8');
  const lib = (rel: string) => readFileSync(resolve(process.cwd(), 'src/lib', rel), 'utf8');
  const shell = readFileSync(resolve(process.cwd(), 'src/shell/AppShell.tsx'), 'utf8');
  const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

  const directorio = screen('directory/Directory.tsx');
  const tablaDirectorio = screen('directory/DirectoryTable.tsx');
  const ficha = screen('directory/OrganizationProfile.tsx');
  const foro = screen('forum/Forum.tsx');
  const categoria = screen('forum/ForumCategory.tsx');
  const hiloForo = screen('forum/ForumThread.tsx');
  const libForo = lib('forum.ts');
  const panel = screen('panel/Panel.tsx');
  const invitaciones = screen('onboarding/Invitations.tsx');
  const tablasInvitaciones = screen('onboarding/InvitationTables.tsx');
  const enlace = screen('onboarding/InvitationLinkDialog.tsx');
  const quitar = screen('onboarding/RemoveMemberDialog.tsx');
  const seguridad = screen('settings/ChangePassphrase.tsx') + lib('key-recovery.ts');

  /** [lo que dice la guía, lo que dice el código, dónde]. Casi siempre es la misma cadena. */
  const mismo = (texto: string, fuente: string): [string, string, string] => [texto, texto, fuente];

  it.each([
    // Empresas: Directorio
    mismo('Todos los países', directorio),
    mismo('Buscar organización por nombre', directorio),
    mismo('Limpiar filtros', directorio),
    mismo('Página anterior', directorio),
    mismo('Página siguiente', directorio),
    ['Nombre', "label: 'Nombre'", tablaDirectorio],
    ['País', "label: 'País'", tablaDirectorio],
    ['Teléfono', "label: 'Teléfono'", tablaDirectorio],
    ['Email', "label: 'Email'", tablaDirectorio],
    ['Favoritos', "label: 'Favoritos'", tablaDirectorio],
    // Empresas: ficha
    mismo('Contactar', ficha),
    mismo('Información general', ficha),
    mismo('Contacto público', ficha),
    mismo('Código postal', ficha),
    mismo('Miembro desde', ficha),
    mismo('Administrador', ficha),
    mismo('Primer mensaje', ficha),
    mismo('Enviar y abrir el hilo', ficha),
    ['2000 caracteres', 'maxLength={2000}', ficha],
    // Foro
    ['sin garantía de confidencialidad', 'Nada de lo escrito aquí tiene ninguna garantía de confidencialidad.', foro],
    mismo('Actividad reciente', foro),
    mismo('Categorías', foro),
    mismo('Última actividad', foro),
    mismo('Buscar en esta categoría...', categoria),
    mismo('Limpiar búsqueda', categoria),
    mismo('Crear hilo', categoria),
    mismo('Foros', categoria),
    mismo('Foros', hiloForo),
    mismo('Escribe tu respuesta...', hiloForo),
    mismo('Publicar respuesta', hiloForo),
    ['10 veces por hora', '10 publicaciones por hora', hiloForo],
    // Panel
    mismo('Mi Panel', panel),
    mismo('pendientes de respuesta', panel),
    mismo('sin respuesta', panel),
    mismo('con mensajes sin leer', panel),
    mismo('Resumen mes', panel),
    mismo('Ofertas Aceptadas', panel),
    mismo('Ofertas Realizadas', panel),
    mismo('Consultas Realizadas', panel),
    mismo('Favoritos recibidos', panel),
    mismo('organizaciones te añadieron a favoritos este mes', panel),
    ['visitas de 30 días', 'visitas (30d)', panel],
    // Configuración y Seguridad
    mismo('Configuración', shell),
    mismo('Seguridad', shell),
    mismo('Gestión de invitaciones', invitaciones),
    mismo('Invitar nuevo usuario', invitaciones),
    mismo('Email del nuevo usuario', invitaciones),
    mismo('Enviar invitación', invitaciones),
    ['ya tiene cuenta', 'Este email ya tiene cuenta en Bearingworld.io.', invitaciones],
    ['el límite es de 5 usuarios por organización', 'Límite: 5 usuarios por organización', invitaciones],
    mismo('Usuario activo', invitaciones),
    mismo('Invitación pendiente', invitaciones),
    mismo('Plaza libre', invitaciones),
    mismo('Enlace de invitación', enlace),
    mismo('Copiar enlace', enlace),
    mismo('Cópialo ahora: no se vuelve a mostrar', enlace),
    mismo('Invitaciones enviadas', tablasInvitaciones),
    mismo('Usuarios activos', tablasInvitaciones),
    mismo('Nuevo enlace', tablasInvitaciones),
    mismo('Anular', tablasInvitaciones),
    mismo('Reenviar', tablasInvitaciones),
    mismo('Eliminar usuario', quitar),
    mismo('Cambiar backup passphrase', seguridad),
    mismo('Passphrase actual', seguridad),
    mismo('Nueva passphrase', seguridad),
    mismo('Repetir nueva passphrase', seguridad),
    mismo('Guardar cambios', seguridad),
    ['sin histórico', 'no hay histórico', seguridad],
  ])('«%s» (guía) existe en la pantalla: %s', (enGuia, enCodigo, fuente) => {
    expect(fuente).toContain(enCodigo);
    expect(prompt).toContain(enGuia);
  });

  it('Directorio: busca con Intro o lupa, solo tres cabeceras ordenan y el nombre abre la ficha', () => {
    expect(directorio).toMatch(/onSubmit=\{runSearch\}/);
    expect(directorio).toMatch(/function handleCountryChange[\s\S]*?setFilters/);
    expect(directorio).toMatch(/hasActiveFilters\(filters\) && \(/);
    expect(tablaDirectorio).toMatch(/\{ label: 'Nombre', field: 'name' \}/);
    expect(tablaDirectorio).toMatch(/\{ label: 'País', field: 'country' \}/);
    expect(tablaDirectorio).toMatch(/\{ label: 'Teléfono' \}/);
    expect(tablaDirectorio).toMatch(/\{ label: 'Email' \}/);
    expect(tablaDirectorio).toMatch(/\{ label: 'Favoritos', field: 'favorite_count' \}/);
    expect(tablaDirectorio).toContain("row.phone === '' ? '—'");
    expect(tablaDirectorio).toContain("row.email === '' ? '—'");
    expect(tablaDirectorio).toMatch(/onClick=\{\(\) => onOpenOrganization\(row\.id\)\}/);
  });

  it('Ficha: Contactar abre el hilo existente o el primer mensaje, apagado en la propia organización; sin botón de favorito', () => {
    expect(ficha).toMatch(/if \(threadId !== null\) onOpenThread\(threadId\);\s*else setComposing\(true\);/);
    expect(ficha).toContain('const canContact = !own &&');
    expect(ficha).toMatch(/disabled=\{!canContact\}/);
    expect(ficha).toContain('orDash(');
    expect(ficha).not.toMatch(/Añadir a favoritos|Marcar como favorita|toggleFavorite/);
    expect(ficha).toMatch(/onClick=\{onBack\}/);
  });

  it('Foro: «Actividad reciente» no abre nada, la categoría sí, y «Crear hilo» está apagado', () => {
    expect(foro).toMatch(/className=\{styles\.recentItem\}[\s\S]{0,200}\bdisabled\b/);
    expect(foro).toMatch(/threads\.length > 0 && \(/);
    expect(foro).toMatch(/onClick=\{onOpenCategory \? \(\) => onOpenCategory\(category\.slug\) : undefined\}/);
    expect(foro).toContain('lastActivityAt !== null');
    expect(categoria).toMatch(/className=\{styles\.createButton\}\s*disabled/);
    expect(categoria).toMatch(/onClick=\{\(\) => onOpenThread\(row\.id\)\}/);
    expect(categoria).toContain('pageCount > 1 &&');
    expect(categoria).toMatch(/onSubmit=\{runSearch\}/);
  });

  it('Foro: el hilo alterna la reacción, Editar y Eliminar siempre apagados, y el límite apaga «Publicar respuesta»', () => {
    expect(hiloForo).toMatch(/if \(post\.reactedByMe\) \{\s*await unreactToPost\(post\.id\);\s*\} else \{\s*await reactToPost\(post\.id\);/);
    expect(hiloForo).toMatch(/post\.authorOrgId === profile\.orgId && \(/);
    expect(hiloForo).toMatch(/disabled\s*title="Editar todavía no está disponible/);
    expect(hiloForo).toMatch(/disabled\s*title="Eliminar todavía no está disponible/);
    expect(hiloForo).toContain("disabled={draft.trim() === '' || rateLimitReached(rateStatus) || submitting}");
    expect(libForo).toContain('`👍 ${n}`');
  });

  it('Panel: cada tarjeta lleva a la pantalla que la guía dice, y «Favoritos recibidos» no lleva a ninguna', () => {
    const tarjeta = (testid: string) => {
      const i = panel.indexOf(`data-testid="${testid}"`);
      return panel.slice(Math.max(0, i - 120), i + 120);
    };
    expect(tarjeta('card-ofertas')).toContain("onNavigate('Vendiendo')");
    expect(tarjeta('card-consultas')).toContain("onNavigate('Comprando')");
    expect(tarjeta('card-inventario')).toContain("onNavigate('Inventario')");
    expect(tarjeta('card-hilos')).toContain("onNavigate('Hilos')");
    expect(tarjeta('card-resumen-mes')).toContain("onNavigate('Vendiendo')");
    expect(tarjeta('card-favoritos')).not.toContain('onNavigate');
    expect(lib('panel.ts')).toContain("n === null ? '—' : String(n)");
  });

  it('Configuración: solo es botón para el ADMIN y abre las invitaciones; Seguridad solo con backup de clave', () => {
    expect(app).toMatch(/state\.profile\.role === 'ADMIN'\s*\?\s*\{\s*onOpenSettings:/);
    expect(app).toMatch(/settingsOpen && state\.profile\.role === 'ADMIN' \? \(\s*\/\*[\s\S]*?\*\/\s*<Invitations/);
    expect(app).toMatch(/hasBackup\s*\?\s*\{\s*onOpenSecurity:/);
    expect(app).toMatch(/securityOpen && hasBackup \? \([\s\S]*?<ChangePassphrase/);
    expect(shell).toMatch(/onOpenSettings \? \(\s*<button/);
    expect(shell).toMatch(/onOpenSecurity \? \(\s*<button/);
  });

  it('Invitaciones: tope de 5, rol Editor, acciones por estado y Eliminar solo a Editores con confirmación', () => {
    expect(lib('invitations.ts')).toContain('export const MAX_USERS = 5;');
    expect(invitaciones).toContain('rol <strong>Editor</strong>');
    expect(invitaciones).toContain('disabled={atLimit || sending}');
    expect(tablasInvitaciones).toMatch(/invitation\.status === 'Expirada' \|\| invitation\.status === 'Anulada'[\s\S]*?Reenviar/);
    expect(tablasInvitaciones).toMatch(/invitation\.status === 'Pendiente' && \(onNewLink \|\| onRevoke\)[\s\S]*?Nuevo enlace[\s\S]*?Anular/);
    expect(tablasInvitaciones).toContain('canRemove(member, selfId)');
    expect(tablasInvitaciones).toContain('Solo se pueden eliminar usuarios con rol Editor');
    expect(invitaciones).toContain('<RemoveMemberDialog');
    expect(quitar).toContain('Cancelar');
  });

  it('Seguridad: la passphrase nueva pide 12 caracteres y el backup anterior se sobrescribe', () => {
    expect(seguridad).toContain('Mínimo 12 caracteres');
    expect(seguridad).toContain('El backup anterior se sobrescribe: no hay histórico.');
    expect(seguridad).toContain('Demasiados intentos.');
  });
});

describe('VERA · la guía del chip de país (F-229) sigue siendo cierta', () => {
  const libBusqueda = readFileSync(resolve(process.cwd(), 'src/lib/search.ts'), 'utf8');
  const chips = readFileSync(resolve(process.cwd(), 'src/screens/search/FilterChips.tsx'), 'utf8');

  it('con solo país, el chip se llama País; y se puede añadir sin zona', () => {
    expect(prompt).toContain('que se llama "País" cuando solo hay país');
    expect(libBusqueda).toContain("c.zone ? CHIP_LABELS.zone : 'País'");
    expect(prompt).toContain('se puede poner solo el país');
    expect(chips).toContain("!(field === 'zone' && country)");
  });
});

// F-101 (14-oct-2026, decisión del PO): VERA recibe la conversación. Lo que esto prueba es que las reglas
// siguen escritas; si el modelo las cumple solo lo dice una llamada real (plan de pruebas de VERA).
describe('VERA · memoria de la conversación (F-101)', () => {
  it('la regla vieja de «cada pregunta te llega sola» ya no está: hoy sería falsa', () => {
    expect(prompt).toContain('LA CONVERSACIÓN TE LLEGA; LOS DATOS, NO');
    expect(prompt).not.toContain('CADA PREGUNTA TE LLEGA SOLA');
    expect(prompt).not.toContain('No recibes la pregunta anterior');
  });

  it('lo que contestó antes no es un dato: se vuelve a consultar', () => {
    expect(prompt).toContain('lo que contestaste antes NO es un dato');
    expect(prompt).toContain('sale de una herramienta llamada para ESTA pregunta');
  });

  it('afinar es mandar todos los filtros, y la pantalla manda sobre lo recordado', () => {
    expect(prompt).toContain('le mandas TODOS los filtros que deben quedar puestos');
    expect(prompt).toContain('el usuario puede haberlos cambiado a mano');
  });

  it('sin búsqueda previa, una continuación se pregunta y no se busca (F-101 de agosto, sigue)', () => {
    expect(prompt).toContain('no hay ninguna búsqueda ni en la conversación ni en Comprando, NO LO BUSQUES');
  });

  it('el bloque dinámico lleva los filtros y el aviso de lo omitido, sin marca de caché', () => {
    expect(prompt).toContain('los filtros puestos en Comprando eran');
    expect(prompt).toContain('intercambios más antiguos no te llegan');
    // El estático es el único con cache_control: lo que cambia por petición va detrás.
    expect(prompt.match(/cache_control/g)).toHaveLength(1);
  });

  it('el proxy pone tope al tamaño de la petición', () => {
    expect(prompt).toContain('const MAX_MENSAJES = 60;');
    expect(prompt).toContain('const MAX_CARACTERES = 150_000;');
    expect(prompt).toMatch(/entrada\.messages\.length > MAX_MENSAJES/);
    expect(prompt).toContain('413');
  });
});

// Decisión del PO del 14-oct-2026: cuando la pantalla ya enseña la respuesta, VERA no la repite.
describe('VERA · no repite lo que la pantalla ya enseña', () => {
  it('tras buscar en el catálogo, una línea; y solo dos cosas sin que se las pidan', () => {
    expect(prompt).toContain('CUANDO LA PANTALLA YA ENSEÑA LA RESPUESTA, NO LA REPITAS');
    expect(prompt).toContain('No repitas las filas');
    expect(prompt).toContain('contesta esa pregunta en una o dos frases, y nada más');
    expect(prompt).toContain('que no hay ningún resultado —y entonces propones qué filtro quitar');
  });

  it('el inventario solo mueve la pantalla cuando la respuesta es una lista', () => {
    expect(prompt).toContain('llámala con mostrar_en_pantalla a true');
    expect(prompt).toContain('no muevas la pantalla —puede estar en un hilo—');
    expect(tools).toContain('"mostrar_en_pantalla"');
  });

  it('en Hilos el texto sí es la respuesta, breve', () => {
    expect(prompt).toContain('listar_mis_hilos no mueve la pantalla');
  });
});
