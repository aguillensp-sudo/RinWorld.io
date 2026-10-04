import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  columnsOf,
  parseImportText,
  proposeMapping,
  type ColumnProposal,
  type ParsedFile,
  type PlatformField,
} from '../../lib/inventory-import';
import { ImportMapping } from './ImportMapping';

/**
 * CONTRATO DE ACEPTACIÓN · INV-02 (Procesamiento y Mapeo de Columnas).
 *
 * Lo escribe Claude Code ANTES de la corrida; el Coder no lo ve (`CLAUDE.md` §3). La
 * pantalla es presentacional: recibe el archivo ya leído y la propuesta, deja corregir el
 * mapeo, elegir política y, si se quiere, nombre de perfil, y entrega la elección con
 * `onConfirm`. Escribir lo hace `App.tsx` (`runImport`), no esta pantalla.
 */

const CSV = [
  'Ref.;Fabricante;Uds.;País;PVP;Obs.',
  '6205-2RS/C3;SKF;850;ES;4.20;Stock almacén',
  'NU216;FAG;1.200;DE;9.10;',
].join('\n');

const FILE = parseImportText('inventario_junio_2026.csv', CSV) as ParsedFile;
const PROPOSAL = proposeMapping(columnsOf(FILE));
const MAPPING = PROPOSAL.map((p) => p.field);

function renderScreen(over: Partial<Parameters<typeof ImportMapping>[0]> = {}) {
  const props = {
    file: FILE,
    proposal: PROPOSAL,
    initialMapping: MAPPING,
    appliedProfile: null,
    busy: false,
    error: null,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...over,
  };
  render(<ImportMapping {...props} />);
  return props;
}

const confirmBtn = () => screen.getByRole('button', { name: 'Confirmar e importar' });
const selectFor = (header: string) =>
  screen.getByRole('combobox', { name: `Campo en plataforma para ${header}` }) as HTMLSelectElement;

describe('INV-02 · cabecera y archivo', () => {
  it('raíz con su testid, eyebrow, h1 y subtítulo verbatim', () => {
    renderScreen();
    expect(screen.getByTestId('import-mapping')).toBeInTheDocument();
    expect(screen.getByText('Módulo 02 · Gestión de Inventario')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Confirma el mapeo de columnas' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Hemos analizado tu archivo. Revisa cómo se mapean tus columnas a los campos de la plataforma antes de importar.',
      ),
    ).toBeInTheDocument();
  });

  it('bloque del archivo: nombre, «Subido hace un momento» y las tres pills', () => {
    renderScreen();
    const block = screen.getByTestId('import-file');
    expect(within(block).getByText('inventario_junio_2026.csv')).toBeInTheDocument();
    expect(within(block).getByText('Subido hace un momento')).toBeInTheDocument();
    expect(within(block).getByText('2 filas')).toBeInTheDocument();
    expect(within(block).getByText('6 columnas')).toBeInTheDocument();
    expect(within(block).getByText('Muestra: 2 filas')).toBeInTheDocument();
  });

  it('las cifras de las pills van con punto de millares', () => {
    const big: ParsedFile = { name: 'g.csv', headers: ['Ref'], rows: Array.from({ length: 1247 }, () => ['6205']) };
    renderScreen({ file: big, proposal: [{ field: 'part_number', confidence: 92 }], initialMapping: ['part_number'] });
    expect(within(screen.getByTestId('import-file')).getByText('1.247 filas')).toBeInTheDocument();
    expect(within(screen.getByTestId('import-file')).getByText('1 columna')).toBeInTheDocument();
  });

  it('no pinta el panel de VERA ni los botones «Demo:» del prototipo', () => {
    renderScreen();
    expect(screen.queryByText(/^Demo:/)).not.toBeInTheDocument();
    expect(screen.queryByText('VERA')).not.toBeInTheDocument();
  });
});

describe('INV-02 · tabla de mapeo', () => {
  it('una tabla de verdad con sus cuatro cabeceras', () => {
    renderScreen();
    expect(screen.getByRole('heading', { level: 2, name: 'Mapeo de columnas' })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Mapeo de columnas' });
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Columna en tu archivo',
      'Ejemplo de valor',
      'Campo en plataforma',
      'Confianza',
    ]);
  });

  it('una fila por columna, con su cabecera, su ejemplo, su desplegable y su confianza', () => {
    renderScreen();
    const rows = screen.getAllByTestId('mapping-row');
    expect(rows).toHaveLength(6);
    const cells = within(rows[0] as HTMLElement).getAllByRole('cell');
    expect(cells).toHaveLength(4);
    expect(cells[0]).toHaveTextContent('Ref.');
    expect(cells[1]).toHaveTextContent('6205-2RS/C3');
    expect(within(cells[2] as HTMLElement).getByRole('combobox')).toHaveValue('part_number');
    expect(cells[3]).toHaveTextContent('92%');
  });

  it('una columna sin ningún valor enseña «—» como ejemplo', () => {
    const f: ParsedFile = { name: 'x.csv', headers: ['Ref', 'Vacía'], rows: [['6205', '']] };
    renderScreen({
      file: f,
      proposal: [
        { field: 'part_number', confidence: 92 },
        { field: 'ignore', confidence: 10 },
      ],
      initialMapping: ['part_number', 'ignore'],
    });
    const cells = within(screen.getAllByTestId('mapping-row')[1] as HTMLElement).getAllByRole('cell');
    expect(cells[1]).toHaveTextContent('—');
  });

  it('cada desplegable tiene las ocho opciones del HTML aprobado, en su orden, y price deshabilitada', () => {
    renderScreen();
    const options = within(selectFor('Ref.')).getAllByRole('option') as HTMLOptionElement[];
    expect(options.map((o) => o.textContent)).toEqual([
      'part_number — Referencia del rodamiento *',
      'brand — Marca / Fabricante *',
      'quantity — Cantidad disponible *',
      'location_country — País de stock *',
      'price — Precio (E2EE)',
      'lead_time_days — Plazo de entrega',
      'notes — Notas adicionales',
      '— Ignorar esta columna —',
    ]);
    expect(options.map((o) => o.value)).toEqual([
      'part_number',
      'brand',
      'quantity',
      'location_country',
      'price',
      'lead_time_days',
      'notes',
      'ignore',
    ]);
    expect(options.filter((o) => o.disabled).map((o) => o.value)).toEqual(['price']);
  });

  it('los desplegables arrancan con `initialMapping`, no con la propuesta', () => {
    const fromProfile: PlatformField[] = ['brand', 'part_number', 'quantity', 'location_country', 'ignore', 'ignore'];
    renderScreen({ initialMapping: fromProfile });
    expect(selectFor('Ref.')).toHaveValue('brand');
    expect(selectFor('Fabricante')).toHaveValue('part_number');
  });

  it('la confianza lleva su tono: hi > 85, mid 60–85, lo < 60', () => {
    const proposal: ColumnProposal[] = [
      { field: 'part_number', confidence: 97 },
      { field: 'brand', confidence: 85 },
      { field: 'quantity', confidence: 60 },
      { field: 'location_country', confidence: 86 },
      { field: 'ignore', confidence: 59 },
      { field: 'ignore', confidence: 12 },
    ];
    renderScreen({ proposal });
    const badges = screen.getAllByTestId('mapping-row').map((r) => within(r).getByTestId('confidence'));
    expect(badges.map((b) => b.textContent)).toEqual(['97%', '85%', '60%', '86%', '59%', '12%']);
    expect(badges.map((b) => b.getAttribute('data-tone'))).toEqual(['hi', 'mid', 'mid', 'hi', 'lo', 'lo']);
  });

  it('elegir un campo que ya tenía otra columna se lo quita a esa (pasa a ignorar)', async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.selectOptions(selectFor('Obs.'), 'brand');
    expect(selectFor('Obs.')).toHaveValue('brand');
    expect(selectFor('Fabricante')).toHaveValue('ignore');
  });

  it('price no se puede elegir', async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.selectOptions(selectFor('PVP'), 'price').catch(() => undefined);
    expect(selectFor('PVP')).not.toHaveValue('price');
  });
});

describe('INV-02 · obligatorios', () => {
  it('con los cuatro obligatorios mapeados, el botón está habilitado y sin tooltip', () => {
    renderScreen();
    expect(confirmBtn()).toBeEnabled();
    expect(confirmBtn()).not.toHaveAttribute('title');
    expect(screen.getAllByTestId('mapping-row').filter((r) => r.getAttribute('data-unmapped') === 'true')).toHaveLength(0);
  });

  it('si falta uno, el botón se deshabilita con el tooltip de la spec y las filas ignoradas se marcan', async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.selectOptions(selectFor('Fabricante'), 'ignore');
    expect(confirmBtn()).toBeDisabled();
    expect(confirmBtn()).toHaveAttribute('title', 'Debes mapear las columnas: brand');
    const rows = screen.getAllByTestId('mapping-row');
    // Fabricante (ahora ignorada) y PVP (ignorada desde la propuesta); Obs. va a `notes`.
    expect(rows.map((r) => r.getAttribute('data-unmapped'))).toEqual([null, 'true', null, null, 'true', null]);
  });

  it('volver a mapearlo lo habilita otra vez', async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.selectOptions(selectFor('Fabricante'), 'ignore');
    await user.selectOptions(selectFor('Obs.'), 'brand');
    expect(confirmBtn()).toBeEnabled();
  });
});

describe('INV-02 · perfil', () => {
  it('sin perfil aplicado no hay banner', () => {
    renderScreen();
    expect(screen.queryByTestId('profile-banner')).not.toBeInTheDocument();
  });

  it('con perfil aplicado, el banner de la spec', () => {
    renderScreen({ appliedProfile: 'Formato Excel mensual' });
    expect(screen.getByTestId('profile-banner')).toHaveTextContent(
      'Hemos aplicado automáticamente el perfil "Formato Excel mensual". Revisa que todo sea correcto.',
    );
  });

  it('el nombre del perfil solo aparece al marcar la casilla, con su placeholder y su pista', async () => {
    const user = userEvent.setup();
    renderScreen();
    const check = screen.getByRole('checkbox', {
      name: 'Guardar este mapeo como perfil para futuros archivos con esta estructura',
    });
    expect(check).not.toBeChecked();
    expect(screen.queryByRole('textbox', { name: 'Nombre del perfil' })).not.toBeInTheDocument();
    await user.click(check);
    const name = screen.getByRole('textbox', { name: 'Nombre del perfil' });
    expect(name).toHaveAttribute('placeholder', 'Ej: Formato Excel mensual');
    expect(name).toHaveAttribute('maxLength', '50');
    expect(
      screen.getByText('Mín. 3 / máx. 50 caracteres · Próximas subidas con estructura similar se mapearán automáticamente'),
    ).toBeInTheDocument();
  });

  it('marcada y con un nombre de menos de 3 caracteres, no se puede confirmar', async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByRole('checkbox'));
    expect(confirmBtn()).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Nombre del perfil' }), 'ab');
    expect(confirmBtn()).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Nombre del perfil' }), 'c');
    expect(confirmBtn()).toBeEnabled();
  });
});

describe('INV-02 · política y confirmación', () => {
  it('dos radios, «Reemplazo total» marcado por defecto, con sus descripciones del HTML', () => {
    renderScreen();
    expect(screen.getByRole('heading', { level: 2, name: 'Política de actualización' })).toBeInTheDocument();
    const replace = screen.getByRole('radio', { name: /Reemplazo total/ });
    const accum = screen.getByRole('radio', { name: /Acumulativo/ });
    expect(replace).toBeChecked();
    expect(accum).not.toBeChecked();
    expect(
      screen.getByText(
        'El archivo sustituye completamente el inventario publicado. Las referencias que no estén en el archivo se eliminarán.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'El archivo añade o actualiza líneas sin eliminar las existentes. Útil para actualizaciones parciales de stock.',
      ),
    ).toBeInTheDocument();
  });

  it('confirmar entrega el mapeo, la política y profileName null', async () => {
    const user = userEvent.setup();
    const props = renderScreen();
    await user.click(confirmBtn());
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith({ mapping: MAPPING, policy: 'REPLACE', profileName: null });
  });

  it('con Acumulativo, otro mapeo y perfil, lo entrega todo (el nombre recortado)', async () => {
    const user = userEvent.setup();
    const props = renderScreen();
    await user.click(screen.getByRole('radio', { name: /Acumulativo/ }));
    await user.selectOptions(selectFor('Obs.'), 'ignore');
    await user.click(screen.getByRole('checkbox'));
    await user.type(screen.getByRole('textbox', { name: 'Nombre del perfil' }), '  Formato ERP ');
    await user.click(confirmBtn());
    expect(props.onConfirm).toHaveBeenCalledWith({
      mapping: ['part_number', 'brand', 'quantity', 'location_country', 'ignore', 'ignore'],
      policy: 'ACCUMULATE',
      profileName: 'Formato ERP',
    });
  });

  it('cancelar llama a onCancel', async () => {
    const user = userEvent.setup();
    const props = renderScreen();
    await user.click(screen.getByRole('button', { name: 'Cancelar y volver al inventario' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('mientras importa: el botón dice «Importando…» y los dos están deshabilitados', () => {
    renderScreen({ busy: true });
    expect(screen.getByRole('button', { name: 'Importando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar y volver al inventario' })).toBeDisabled();
  });

  it('un error de la base se enseña en una alerta y se puede reintentar', () => {
    renderScreen({ error: 'Límite de inventario alcanzado' });
    expect(screen.getByRole('alert')).toHaveTextContent('Límite de inventario alcanzado');
    expect(confirmBtn()).toBeEnabled();
  });

  it('más de 20.000 filas: aviso y botón bloqueado', () => {
    const big: ParsedFile = { name: 'g.csv', headers: FILE.headers, rows: Array.from({ length: 20001 }, () => FILE.rows[0] as string[]) };
    renderScreen({ file: big });
    expect(screen.getByTestId('limit-warning')).toHaveTextContent(
      'El archivo tiene 20.001 filas y el máximo por subida es 20.000. Divídelo en varios archivos.',
    );
    expect(confirmBtn()).toBeDisabled();
  });

  it('todo lo accionable es <button type="button">', () => {
    renderScreen();
    for (const b of screen.getAllByRole('button')) expect(b).toHaveAttribute('type', 'button');
  });
});
