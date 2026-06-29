/**
 * nav.js — Navegación entre prototipos Bearingworld.io
 * Activa los ítems de nav bar y sidebar en todas las pantallas.
 */
(function () {

  /* ── Mapeo nav label → fichero HTML ─────────────────────────── */
  var NAV = {
    // Nav estándar de usuario
    'Panel'        : 'Rinworld_app_shell.html',
    'Vendiendo'    : 'INV-07 · VIS v1.0.html',
    'Comprando'    : 'SRCH-01 · SRCH v1.0.html',
    'Hilos'        : 'MSG-01 · MSG v1.0.html',
    'Inventario'   : 'INV-01 · INV v1.0.html',
    'Empresas'     : 'DIR-01 · DIR v1.0.html',
    'Foros'        : 'FORO-01 · FORO v1.0.html',
    'Contacto'     : '../../../index.html',
    // Nav de operador
    'Solicitudes'  : 'ADMIN-01 · ADMIN v1.0.html',
    'Cobros'       : 'ADMIN-02 · ADMIN v1.0.html',
    'Organizaciones': 'DIR-01 · DIR v1.0.html',
    'Log de auditoría': null,
    'Sistema'      : null,
    // Sub-módulos accesibles desde el índice
    'Búsqueda por lotes': 'SRCH-02 · SRCH v1.0.html',
    'Watchers'     : 'SRCH-03 · SRCH v1.0.html',
  };

  /* ── Activa nav bar + sidebar ────────────────────────────────── */
  document.querySelectorAll('.bwnavitem, .bwsbitem').forEach(function (el) {
    var text = el.textContent.trim();
    if (NAV[text]) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        window.location.href = NAV[text];
      }, true);           // capture phase — tiene prioridad sobre onclick inline
    }
  });

  /* ── Flujos de acción por pantalla ──────────────────────────── */
  var page = window.location.pathname.split('/').pop().split('%20')[0];

  /* SRCH-01: filas de resultados → MSG-02 */
  if (page === 'SRCH-01') {
    document.querySelectorAll('tr[onclick], .srch-row, tbody tr').forEach(function (row) {
      row.style.cursor = 'pointer';
      row.addEventListener('click', function () {
        window.location.href = 'MSG-02 · MSG v1.0.html';
      });
    });
    // Botón "Consultar" en el panel de detalle
    document.querySelectorAll('button').forEach(function (btn) {
      if (btn.textContent.trim() === 'Consultar') {
        btn.addEventListener('click', function () {
          window.location.href = 'MSG-02 · MSG v1.0.html';
        });
      }
    });
  }

  /* SRCH-02 → SRCH-01 */
  if (page === 'SRCH-02') {
    document.querySelectorAll('button').forEach(function (btn) {
      var t = btn.textContent.trim();
      if (t === 'Ver detalle' || t === 'Abrir resultado') {
        btn.addEventListener('click', function () {
          window.location.href = 'SRCH-01 · SRCH v1.0.html';
        });
      }
    });
  }

  /* MSG-01: filas de hilo → MSG-02 */
  if (page === 'MSG-01') {
    document.querySelectorAll('tr[onclick], tbody tr, .thread-row').forEach(function (row) {
      row.style.cursor = 'pointer';
      row.addEventListener('click', function () {
        window.location.href = 'MSG-02 · MSG v1.0.html';
      });
    });
  }

  /* MSG-02: botón "Volver" → MSG-01 */
  if (page === 'MSG-02') {
    document.querySelectorAll('button, a').forEach(function (el) {
      var t = el.textContent.trim();
      if (t === 'Volver' || t === '← Hilos' || t === 'Volver a hilos') {
        el.addEventListener('click', function () {
          window.location.href = 'MSG-01 · MSG v1.0.html';
        });
      }
    });
  }

  /* DIR-01: filas de organización → DIR-02 */
  if (page === 'DIR-01') {
    document.querySelectorAll('tr[onclick], tbody tr, .dir-row').forEach(function (row) {
      row.style.cursor = 'pointer';
      row.addEventListener('click', function () {
        window.location.href = 'DIR-02 · DIR v1.0.html';
      });
    });
  }

  /* FORO-01: filas de categoría → FORO-02 */
  if (page === 'FORO-01') {
    document.querySelectorAll('tr[onclick], tbody tr, .foro-cat-row, .cat-row').forEach(function (row) {
      row.style.cursor = 'pointer';
      row.addEventListener('click', function () {
        window.location.href = 'FORO-02 · FORO v1.0.html';
      });
    });
    document.querySelectorAll('a, button').forEach(function (el) {
      if (el.textContent.trim().startsWith('Entrar') || el.textContent.trim() === 'Ver hilos') {
        el.addEventListener('click', function () {
          window.location.href = 'FORO-02 · FORO v1.0.html';
        });
      }
    });
  }

  /* FORO-02: filas de hilo → FORO-03 · botón volver → FORO-01 */
  if (page === 'FORO-02') {
    document.querySelectorAll('tr[onclick], tbody tr, .thread-row, .hilo-row').forEach(function (row) {
      row.style.cursor = 'pointer';
      row.addEventListener('click', function () {
        window.location.href = 'FORO-03 · FORO v1.0.html';
      });
    });
    document.querySelectorAll('a, button').forEach(function (el) {
      var t = el.textContent.trim();
      if (t === 'Volver' || t === '← Categorías' || t === 'Ver hilo') {
        el.addEventListener('click', function () {
          if (t === 'Ver hilo') {
            window.location.href = 'FORO-03 · FORO v1.0.html';
          } else {
            window.location.href = 'FORO-01 · FORO v1.0.html';
          }
        });
      }
    });
  }

  /* FORO-03: botón volver → FORO-02 */
  if (page === 'FORO-03') {
    document.querySelectorAll('a, button').forEach(function (el) {
      var t = el.textContent.trim();
      if (t === 'Volver' || t === '← Hilos' || t === 'Volver a hilos') {
        el.addEventListener('click', function () {
          window.location.href = 'FORO-02 · FORO v1.0.html';
        });
      }
    });
  }

  /* INV-01: botones de importación → INV-02 */
  if (page === 'INV-01') {
    document.querySelectorAll('button, a').forEach(function (el) {
      var t = el.textContent.trim();
      if (t === 'Importar' || t === 'Subir fichero' || t === 'Nueva importación' || t === 'Importar CSV' || t === 'Cargar inventario') {
        el.addEventListener('click', function () {
          window.location.href = 'INV-02 · INV v1.0.html';
        });
      }
    });
  }

  /* INV-02: confirmar mapeo → INV-03 */
  if (page === 'INV-02') {
    document.querySelectorAll('button').forEach(function (btn) {
      var t = btn.textContent.trim();
      if (t === 'Confirmar' || t === 'Confirmar mapeo' || t === 'Procesar' || t === 'Continuar' || t === 'Importar') {
        btn.addEventListener('click', function () {
          window.location.href = 'INV-03 · INV v1.0.html';
        });
      }
    });
    document.querySelectorAll('button').forEach(function (btn) {
      if (btn.textContent.trim() === 'Cancelar') {
        btn.addEventListener('click', function () {
          window.location.href = 'INV-01 · INV v1.0.html';
        });
      }
    });
  }

  /* INV-03: volver → INV-01 */
  if (page === 'INV-03') {
    document.querySelectorAll('button, a').forEach(function (el) {
      var t = el.textContent.trim();
      if (t === 'Volver' || t === 'Ir a inventario' || t === 'Ver inventario' || t === 'Finalizar') {
        el.addEventListener('click', function () {
          window.location.href = 'INV-01 · INV v1.0.html';
        });
      }
    });
  }

  /* REG-00 → REG-00-WAIT */
  if (page === 'REG-00') {
    document.querySelectorAll('button[type="submit"], button').forEach(function (btn) {
      var t = btn.textContent.trim();
      if (t === 'Enviar solicitud' || t === 'Solicitar acceso' || t === 'Enviar') {
        btn.addEventListener('click', function () {
          window.location.href = 'REG-00-WAIT · WAS v1.0.html';
        });
      }
    });
  }

})();
