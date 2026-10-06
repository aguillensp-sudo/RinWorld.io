import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { columnsOf, parseImportText, proposeMapping, type ParsedFile } from '../../lib/inventory-import';
import { ImportMapping } from './ImportMapping';

/**
 * Lo que se añadió a mano a INV-02 el 6-oct (decisión del PO tras la primera importación
 * real): el motivo de «no se puede confirmar» a la vista, y el país de la organización
 * cuando el archivo no trae columna de país. Fichero aparte para no tocar el contrato
 * de la tarea (`ImportMapping.test.tsx`).
 */

// El archivo de la prueba del PO: sin país, y con «Item Number» como referencia.
const CSV = ['Item Number;Item Type;Qty;Marca', '6205-2RS;Rodamiento;40;SKF', 'NU216;Rodamiento;5;FAG'].join('\n');
const FILE = parseImportText('inv.csv', CSV) as ParsedFile;
const PROPOSAL = proposeMapping(columnsOf(FILE));

function renderScreen(defaultCountry?: string | null) {
  const onConfirm = vi.fn();
  render(
    <ImportMapping
      file={FILE}
      proposal={PROPOSAL}
      initialMapping={PROPOSAL.map((p) => p.field)}
      appliedProfile={null}
      busy={false}
      error={null}
      onConfirm={onConfirm}
      onCancel={vi.fn()}
      {...(defaultCountry === undefined ? {} : { defaultCountry })}
    />,
  );
  return onConfirm;
}

const confirmBtn = () => screen.getByRole('button', { name: 'Confirmar e importar' });

describe('INV-02 · el archivo de la primera importación real', () => {
  it('«Item Number» se reconoce como referencia; «Item Type» no se importa', () => {
    expect(PROPOSAL.map((p) => p.field)).toEqual(['part_number', 'ignore', 'quantity', 'brand']);
  });
});

describe('INV-02 · sin país de organización (la regla de la spec)', () => {
  it('el botón está deshabilitado y el motivo se ve en pantalla, no solo en el tooltip', () => {
    renderScreen();
    expect(confirmBtn()).toBeDisabled();
    expect(screen.getByTestId('missing-hint')).toHaveTextContent('Debes mapear las columnas: location_country');
    expect(screen.queryByTestId('country-notice')).not.toBeInTheDocument();
  });

  it('un país no conocido («—») tampoco vale', () => {
    renderScreen('—');
    expect(confirmBtn()).toBeDisabled();
  });
});

describe('INV-02 · con país de organización', () => {
  it('el archivo sin país se puede importar, y la pantalla dice de dónde sale', () => {
    renderScreen('ES');
    expect(confirmBtn()).toBeEnabled();
    expect(screen.queryByTestId('missing-hint')).not.toBeInTheDocument();
    expect(screen.getByTestId('country-notice')).toHaveTextContent(
      'Tu archivo no trae país: todas las líneas se importarán con ES, el país de tu organización.',
    );
  });

  it('confirmar entrega el país por defecto', async () => {
    const user = userEvent.setup();
    const onConfirm = renderScreen('es');
    await user.click(confirmBtn());
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ policy: 'REPLACE', defaultCountry: 'es' }));
  });

  it('si el usuario mapea una columna a país, el aviso desaparece', async () => {
    const user = userEvent.setup();
    renderScreen('ES');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Campo en plataforma para Item Type' }), 'location_country');
    expect(screen.queryByTestId('country-notice')).not.toBeInTheDocument();
    expect(confirmBtn()).toBeEnabled();
  });

  it('seguir faltando otro obligatorio sí bloquea, y lo dice', async () => {
    const user = userEvent.setup();
    renderScreen('ES');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Campo en plataforma para Marca' }), 'ignore');
    expect(confirmBtn()).toBeDisabled();
    expect(screen.getByTestId('missing-hint')).toHaveTextContent('Debes mapear las columnas: brand');
  });
});
