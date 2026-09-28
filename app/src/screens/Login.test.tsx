import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Login } from './Login';

/**
 * CONTRATO DE ACEPTACIÓN · LOGIN-01 · Iniciar sesión.
 *
 * Escrito antes que el código y por Claude Code (`Plan §6`). **El Coder no lo ve.**
 *
 * ⚠ LO QUE HACE ESTE CONTRATO DISTINTO DE LOS CUATRO ANTERIORES: aquí el rojo no
 * significa "la pantalla está a medias", significa **"nadie entra en la
 * aplicación"**. `auth.setup.ts` corre antes que todos los demás proyectos de
 * Playwright y autentica por estos mismos tres selectores; si el login deja de
 * encontrarse, **no falla el login: falla la suite entera** y el informe apunta a
 * cuarenta tests que no tienen nada que ver.
 *
 * Por eso los literales de §8 de la spec son contrato duro y están aquí abajo con
 * nombre y apellidos.
 */

const noop = vi.fn(async () => true);

describe('CA-LOG-01 · los tres selectores de los que depende la suite', () => {
  it('las dos etiquetas encuentran sus campos', () => {
    // `getByLabelText` exige un `<label for>` de verdad. Un `aria-label` también
    // pasaría aquí, pero el resto de la aplicación usa etiquetas visibles y una
    // etiqueta que solo existe para el lector de pantalla deja el campo sin
    // nombre en la pantalla.
    render(<Login onSubmit={noop} error={null} />);
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
  });

  it('el botón se llama `Entrar`, exactamente', () => {
    render(<Login onSubmit={noop} error={null} />);
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('CA-LOG-05 · la contraseña es un campo de contraseña', () => {
    render(<Login onSubmit={noop} error={null} />);
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
  });

  it('RNG-LOG-04 · los dos campos declaran su autocompletado', () => {
    // Sin esto el gestor de contraseñas del navegador no rellena, y el socio
    // teclea la contraseña a mano delante de todos el día 11.
    render(<Login onSubmit={noop} error={null} />);
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'current-password');
  });
});

describe('CA-LOG-02 y CA-LOG-03 · el envío', () => {
  it('ANCLA · el botón nace deshabilitado y se habilita con los dos campos', async () => {
    // Ancla y ámbito en el mismo test (F-059): "está deshabilitado" lo cumple
    // también un botón que no se habilita nunca. Lo que se mide es la transición.
    const user = userEvent.setup();
    render(<Login onSubmit={noop} error={null} />);
    const boton = screen.getByRole('button', { name: 'Entrar' });

    expect(boton).toBeDisabled();
    await user.type(screen.getByLabelText('Correo electrónico'), 'alpha@bearingworld.test');
    expect(boton).toBeDisabled(); // con uno solo, todavía no
    await user.type(screen.getByLabelText('Contraseña'), 'secreta');
    expect(boton).toBeEnabled();
  });

  it('RNG-LOG-01 · un correo de solo espacios no habilita nada', async () => {
    const user = userEvent.setup();
    render(<Login onSubmit={noop} error={null} />);
    await user.type(screen.getByLabelText('Correo electrónico'), '   ');
    await user.type(screen.getByLabelText('Contraseña'), 'secreta');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();
  });

  it('manda el correo SIN espacios alrededor y la contraseña tal cual', async () => {
    // La contraseña no se recorta: un espacio al final puede ser parte de ella.
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => true);
    render(<Login onSubmit={onSubmit} error={null} />);

    await user.type(screen.getByLabelText('Correo electrónico'), '  alpha@bearingworld.test  ');
    await user.type(screen.getByLabelText('Contraseña'), ' secreta ');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('alpha@bearingworld.test', ' secreta '),
    );
  });

  it('⚠ RNG-LOG-02 · dos clics seguidos NO autentican dos veces', async () => {
    // Seis tests haciendo login a la vez contra el mismo GoTrue dejaron la suite
    // del día 2 intermitente: pasaba aislada y caía una de cada dos corridas
    // completas. Una suite que a veces pasa no sirve de puerta.
    const user = userEvent.setup();
    let resolver: ((v: boolean) => void) | undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<boolean>((r) => {
          resolver = r;
        }),
    );
    render(<Login onSubmit={onSubmit} error={null} />);

    await user.type(screen.getByLabelText('Correo electrónico'), 'alpha@bearingworld.test');
    await user.type(screen.getByLabelText('Contraseña'), 'secreta');
    const boton = screen.getByRole('button', { name: /Entrar/ });
    await user.click(boton);

    expect(boton).toBeDisabled();
    expect(onSubmit).toHaveBeenCalledTimes(1);

    /**
     * ⚠ EL ASERTO QUE FALTABA, Y SU AUSENCIA COSTÓ LA SUITE ENTERA.
     *
     * El artefacto del Coder deshabilitaba **también los dos campos** durante el
     * envío. Los 17 asertos de este contrato pasaron igual, y los cuatro checks
     * del arnés salieron verdes: **lo cazó el e2e**, colgando `auth.setup.ts` —
     * que corre antes que todo lo demás— y con él las otras 47 pruebas.
     *
     * Y lo grave no era el cuelgue. `fixtures.ts` **vacía el campo de contraseña
     * justo después de pulsar Entrar** porque Playwright adjunta al informe un
     * volcado del DOM con el `value` de cada campo, y ese informe se sube como
     * artefacto de la CI (F-038). En un campo inerte `fill('')` no escribe, así
     * que **la contraseña se quedaba dentro del volcado**. Un `disabled` de más
     * desactivaba la mitigación entera.
     *
     * RNG-LOG-02 deshabilita el BOTÓN. Los campos se quedan como están.
     */
    expect(screen.getByLabelText('Correo electrónico')).toBeEnabled();
    expect(screen.getByLabelText('Contraseña')).toBeEnabled();

    resolver?.(true);
  });

  it('RNG-LOG-05 · Enter envía, sin tocar el botón', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => true);
    render(<Login onSubmit={onSubmit} error={null} />);

    await user.type(screen.getByLabelText('Correo electrónico'), 'alpha@bearingworld.test');
    await user.type(screen.getByLabelText('Contraseña'), 'secreta{Enter}');

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });
});

describe('CA-LOG-04 · el error', () => {
  it('ANCLA · se pinta con su texto literal en un nodo de alerta', () => {
    // F-020: un error que no identifica el fallo cuesta más que no tenerlo. El
    // día 3 el login enseñó "[object Object]" tapando un PGRST201 que lo decía
    // todo.
    render(<Login onSubmit={noop} error="Invalid login credentials" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid login credentials');
  });

  it('y sin error no hay alerta ninguna', () => {
    /**
     * ⚠ EL ANCLA VA EN EL MISMO `render`, Y ESTO SE CAZÓ EN CALIENTE.
     *
     * La primera versión de este test hacía solo `render(<Login error={null} />)`
     * y `queryByRole('alert')` a secas — y **pasó en verde contra el esqueleto
     * vacío**, el único de los 17 que lo hizo. Claro: un componente que devuelve
     * `null` no tiene alerta.
     *
     * Es F-058 exactamente, otra vez y escrito por mí. Se arregla montando
     * primero CON error —lo que prueba que esta pantalla sí sabe pintar una
     * alerta— y volviendo a montar sin él.
     */
    const { rerender } = render(<Login onSubmit={noop} error="fallo de prueba" />);
    expect(screen.getByRole('alert')).toBeInTheDocument(); // ancla

    rerender(<Login onSubmit={noop} error={null} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('la identidad y la promesa', () => {
  it('dice Bearingworld.io, y NUNCA Rinworld', () => {
    // `CLAUDE.md` §1.2: los ficheros se llaman `Rinworld_*` por herencia del repo
    // viejo, pero todo lo que ve el usuario dice Bearingworld.io. Nunca al revés.
    const { container } = render(<Login onSubmit={noop} error={null} />);
    expect(screen.getByText('Bearingworld.io')).toBeInTheDocument(); // ancla
    expect(container.textContent ?? '').not.toMatch(/rinworld/i);
  });

  it('la nota de cifrado está, verbatim', () => {
    render(<Login onSubmit={noop} error={null} />);
    expect(
      screen.getByText('Cifrado extremo a extremo · el servidor no ve tu contenido'),
    ).toBeInTheDocument();
  });

  it('⚠ y no ofrece nada detrás de esa nota (F-027)', () => {
    // En el MVP no hay respaldo de clave, ni passphrase, ni recuperación. Un
    // enlace de "saber más" o un botón al lado prometería algo que no existe.
    render(<Login onSubmit={noop} error={null} />);
    expect(
      screen.getByText('Cifrado extremo a extremo · el servidor no ve tu contenido'),
    ).toBeInTheDocument(); // ancla
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('CA-LOG-06 · lo que esta pantalla NO tiene, y es deliberado', () => {
  it('ni registro, ni recuperación de contraseña, ni recordarme', () => {
    // ÁMBITO: los tres negativos van detrás de un ancla que comprueba que la
    // pantalla SÍ pinta su formulario. Sobre un componente vacío pasarían solos,
    // que es exactamente el defecto de F-058.
    render(<Login onSubmit={noop} error={null} />);
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument(); // ancla

    expect(
      screen.queryByRole('button', { name: /crear cuenta|registrar|regístrate/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/olvidad[oa]|recuperar contraseña|restablecer/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('no anuncia funciones con fecha que nadie se ha comprometido a cumplir', () => {
    const { container } = render(<Login onSubmit={noop} error={null} />);
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument(); // ancla
    expect(container.textContent ?? '').not.toMatch(/próximamente|pronto|en breve/i);
  });

  it('el dato de ejemplo va en el placeholder, nunca en el valor', () => {
    // Un `value` precargado se envía si el usuario no lo borra, y el socio
    // acabaría intentando entrar como `nombre@empresa.com`.
    render(<Login onSubmit={noop} error={null} />);
    const correo = screen.getByLabelText('Correo electrónico');
    expect(correo).toHaveAttribute('placeholder', 'nombre@empresa.com');
    expect(correo).toHaveValue('');
  });
});
