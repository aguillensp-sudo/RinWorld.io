import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MemberProfile } from './session';
import { runTool, type DirectoryView, type Screen, type ToolContext } from './vera-tools';

/**
 * `organization-directory/directory-access-from-vera#1`: el usuario pide a VERA «muéstrame las organizaciones
 * de Polonia»; VERA aplica el filtro de país sobre el Directorio y la tabla sale filtrada.
 *
 * Aquí se prueba lo que hace la herramienta (qué pantalla mueve, con qué filtro, qué le dice al modelo). Que el
 * modelo traduzca «Polonia» a `PL` solo lo dice una llamada real, que no corre en CI (`CLAUDE.md` §5).
 */

const aqui = dirname(fileURLToPath(import.meta.url));
const tools = JSON.parse(readFileSync(resolve(aqui, '../../../supabase/functions/vera/tools.json'), 'utf8')) as {
  name: string;
  description: string;
  input_schema: { properties: Record<string, { type: string; description: string }>; required: string[] };
}[];

const PERFIL: MemberProfile = {
  id: 'member-alpha',
  email: 'alpha@bearingworld.io',
  fullName: 'Alpha Uno',
  role: 'ADMIN',
  state: 'ACTIVE',
  orgId: 'org-alpha',
  orgName: 'Alpha Rodamientos',
  orgCountry: 'ES',
};

const fetchDirectoryCountries = vi.fn();
vi.mock('./directory', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./directory')>()),
  fetchDirectoryCountries: () => fetchDirectoryCountries(),
}));

let destinos: Screen[] = [];
let vistas: DirectoryView[] = [];

function contexto(conDirectorio = true): ToolContext {
  return {
    profile: PERFIL,
    navigate: (s) => destinos.push(s),
    setCriteria: () => {},
    threadOpen: false,
    prepareDraft: () => {},
    ...(conDirectorio ? { showDirectory: (v: DirectoryView) => vistas.push(v) } : {}),
  };
}

beforeEach(() => {
  destinos = [];
  vistas = [];
  fetchDirectoryCountries.mockReset();
  fetchDirectoryCountries.mockResolvedValue([
    { code: 'DE', label: 'Alemania' },
    { code: 'PL', label: 'Polonia' },
  ]);
});

describe('navegar con país · el Directorio filtrado', () => {
  it('ANCLA · «las organizaciones de Polonia»: abre Empresas con PL puesto y no mueve la pantalla por otra vía', async () => {
    const r = await runTool('navegar', { pantalla: 'Empresas', pais: 'PL' }, contexto());
    expect(r.isError).toBe(false);
    expect(vistas).toEqual([{ country: 'PL' }]);
    expect(destinos).toEqual([]);
    expect(r.content).toContain('Polonia');
  });

  it('acepta el código en minúsculas y con espacios', async () => {
    await runTool('navegar', { pantalla: 'Empresas', pais: ' pl ' }, contexto());
    expect(vistas).toEqual([{ country: 'PL' }]);
  });

  it('a VERA se le dice que no ha visto las filas, para que no cuente ni nombre organizaciones', async () => {
    const r = await runTool('navegar', { pantalla: 'Empresas', pais: 'PL' }, contexto());
    expect(r.content).toMatch(/no cuentes ni nombres organizaciones/i);
  });

  it('un país sin organizaciones NO mueve la pantalla y lista los que sí tienen', async () => {
    const r = await runTool('navegar', { pantalla: 'Empresas', pais: 'FR' }, contexto());
    expect(vistas).toEqual([]);
    expect(destinos).toEqual([]);
    expect(r.content).toContain('FR');
    expect(r.content).toContain('Alemania (DE)');
    expect(r.content).toContain('Polonia (PL)');
  });

  it('lo que no es un código de dos letras se rechaza sin consultar la base', async () => {
    const r = await runTool('navegar', { pantalla: 'Empresas', pais: 'Polonia' }, contexto());
    expect(r.isError).toBe(true);
    expect(vistas).toEqual([]);
    expect(fetchDirectoryCountries).not.toHaveBeenCalled();
    expect(r.content).toContain('PL para Polonia');
  });

  it('el filtro de país con otra pantalla es un error y no mueve nada', async () => {
    const r = await runTool('navegar', { pantalla: 'Inventario', pais: 'PL' }, contexto());
    expect(r.isError).toBe(true);
    expect(vistas).toEqual([]);
    expect(destinos).toEqual([]);
  });

  it('sin el gancho del Directorio abre Empresas y DICE que no ha quedado filtrada', async () => {
    const r = await runTool('navegar', { pantalla: 'Empresas', pais: 'PL' }, contexto(false));
    expect(destinos).toEqual(['Empresas']);
    expect(r.content).toMatch(/NO se ha podido dejar filtrada/);
  });

  it('un fallo al leer los países vuelve COMO FALLO, no como «no hay»', async () => {
    fetchDirectoryCountries.mockRejectedValue(new Error('red caída'));
    const r = await runTool('navegar', { pantalla: 'Empresas', pais: 'PL' }, contexto());
    expect(r.isError).toBe(true);
    expect(r.content).toContain('red caída');
    expect(vistas).toEqual([]);
  });

  it('sin país, navegar a Empresas sigue llevando a la entrada del Directorio, sin consultar países', async () => {
    const r = await runTool('navegar', { pantalla: 'Empresas' }, contexto());
    expect(r.isError).toBe(false);
    expect(destinos).toEqual(['Empresas']);
    expect(vistas).toEqual([]);
    expect(fetchDirectoryCountries).not.toHaveBeenCalled();
  });
});

describe('tools.json · lo que el modelo lee de navegar', () => {
  const navegar = tools.find((t) => t.name === 'navegar')!;

  it('declara `pais` como parámetro opcional de texto, y `pantalla` sigue siendo la única obligatoria', () => {
    expect(navegar.input_schema.properties.pais?.type).toBe('string');
    expect(navegar.input_schema.required).toEqual(['pantalla']);
  });

  it('la descripción dice que con Empresas se filtra por país y que no hay que inventar el código', () => {
    expect(navegar.description).toMatch(/Empresas.*pais/);
    expect(navegar.description).toMatch(/no lo inventes/);
    expect(navegar.input_schema.properties.pais?.description).toContain('PL para Polonia');
  });
});
