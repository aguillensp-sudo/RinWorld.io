**BEARINGWORLD.IO**

**LA PLATAFORMA**

**ESPECIFICACIÓN FUNCIONAL**

**MÓDULO 07 — SUSCRIPCIÓN Y BILLING**

**Construido sobre Módulo 00 y Módulo 01**

Versión 1.1 · Junio 2026 · CONFIDENCIAL

# **1. Propósito y Alcance del Módulo**

Este documento especifica el módulo de Suscripción y Billing de Bearingworld.io: el ciclo de vida del pago anual de cada organización miembro, desde el periodo de prueba gratuito tras la aprobación del registro (Módulo 01) hasta la renovación o suspensión anual. A diferencia de lo que contemplaba el Tech Stack v1.0 (integración con Stripe para gestión automática de cobros), este módulo especifica un modelo deliberadamente manual: la plataforma no procesa ningún pago, y el ciclo de cobro se gestiona mediante transferencia bancaria entre el cliente y Bearingworld.io, fuera de la plataforma, con el Operador de Plataforma confirmando manualmente cada pago recibido.

Este módulo cubre: el periodo de prueba gratuito de 3 meses, el cálculo automático del ciclo anual de 365 días desde el último pago confirmado, los avisos de vencimiento próximo (al cliente y al operador), el panel de gestión de cobros del operador, la suspensión automática por falta de pago confirmado, y la reactivación tras confirmar un pago.

## **1.1 Objetivos funcionales**

* Conceder automáticamente un periodo de prueba de 3 meses a toda organización que completa el onboarding (Módulo 01), sin requerir ninguna acción de pago durante ese periodo.
* Calcular automáticamente la fecha de vencimiento de cada organización: 365 días desde la fecha de último pago confirmado (o desde el fin del periodo de prueba, para el primer ciclo).
* Avisar con 15 días de antelación al vencimiento, tanto al cliente (email) como al Operador de Plataforma (alerta en panel), sin periodo de gracia posterior.
* Suspender automáticamente el acceso de una organización cuyo vencimiento se alcanza sin que el operador haya confirmado el pago correspondiente.
* Proporcionar al Operador de Plataforma un panel donde ve el estado de cobro de cada organización y puede marcar manualmente un pago como recibido, lo que reactiva el acceso si estaba suspendida.

## **1.2 Fuera de alcance en este módulo**

* Cualquier procesamiento de pago dentro de la plataforma. No existe pasarela de pago, no se integra Stripe ni ningún proveedor equivalente, y la plataforma no almacena ni gestiona datos de tarjetas ni cuentas bancarias de los clientes.
* Pagos entre miembros por transacciones comerciales (rodamientos, logística) — cubierto por el principio permanente RNG-MSG-08 del Módulo 04: Bearingworld.io no procesa pagos en ninguna versión, ni entre miembros ni, con este módulo, tampoco para su propia suscripción.
* Gestión contable o fiscal interna de Bearingworld.io (libros contables, declaraciones) — fuera del alcance de un módulo funcional de producto.

|  |
| --- |
| **🏦 SIN PASARELA DE PAGO — TRANSFERENCIA BANCARIA FUERA DE LA PLATAFORMA**  El Tech Stack v1.0 contemplaba un Billing Service con integración Stripe para automatizar cobros, periodos de prueba y dunning. Este módulo lo sustituye por completo: Bearingworld.io no acepta pagos a través de la plataforma bajo ninguna circunstancia, ni de sus propios miembros por la suscripción ni, como ya se estableció en el Módulo 04 (RNG-MSG-08), entre miembros por transacciones comerciales. El cobro de la suscripción anual se realiza por transferencia bancaria directa entre el cliente y Bearingworld.io, gestionada completamente fuera de la plataforma. La plataforma se limita a: (1) calcular y mostrar fechas de vencimiento, (2) generar avisos automáticos, y (3) ofrecer al operador un mecanismo para registrar manualmente que un pago ha sido recibido. El Tech Stack debe actualizarse en una futura revisión para eliminar el Billing Service basado en Stripe y sustituirlo por esta lógica de cálculo de fechas y registro manual, mucho más simple de implementar. |

# **2. Actores del Módulo**

| **Actor** | **Acciones permitidas en este módulo** |
| --- | --- |
| Administrador de Organización | Ver el estado de la suscripción de su organización (días restantes, fecha de último pago, estado), recibir avisos de vencimiento próximo por email (incluidos los datos bancarios para realizar la transferencia, comunicados exclusivamente por ese canal). |
| Operador de Plataforma (mismo rol de ADMIN-01, Módulo 01) | Ver el panel de Billing con el estado de cobro de todas las organizaciones, recibir alertas de vencimientos próximos, marcar manualmente un pago como recibido (lo que actualiza la fecha de último pago y reactiva el acceso si estaba suspendido). |
| Sistema (Billing Service) | Calcular automáticamente los días restantes hasta el vencimiento de cada organización, generar el aviso de 15 días antes (email al cliente + alerta en el panel del operador), y ejecutar la suspensión automática de acceso si se alcanza el día 365 sin pago confirmado. |

# **3. Ciclo de Vida de la Suscripción**

## **3.1 Modelo de precios**

Bearingworld.io utiliza un modelo de precio único: todas las organizaciones pagan la misma cuota de suscripción anual, sin tiers ni planes diferenciados, replicando la política de precio plano del incumbente (PRD, sección 2.1) pero a un precio inferior (Tech Stack v1.1, sección 3.4: recomendación de lanzamiento entre €700–750/año). No existen descuentos automáticos ni planes de pago fraccionado en V1 — el ciclo de cobro es siempre anual.

## **3.2 Fases del ciclo**

| **Fase** | **Duración / Disparador** | **Descripción** |
| --- | --- | --- |
| **Periodo de prueba** | 3 meses (90 días) desde la aprobación de la organización (Módulo 01, estado REGISTERED → KEY\_ACTIVE → ACTIVE). | Acceso completo a la plataforma sin ninguna obligación de pago. Coincide con el periodo en el que la organización completa el onboarding y empieza a usar la plataforma (Phase 2 — Soft Launch del PRD, aunque aquí se aplica también a cualquier alta posterior al lanzamiento). |
| **Primer ciclo de pago** | Día 90 tras la aprobación (fin del periodo de prueba). Vencimiento: día 90. | La organización debe realizar su primera transferencia bancaria antes del día 90. El aviso de 15 días antes (sección 4) se dispara en el día 75. |
| **Ciclos anuales sucesivos** | 365 días desde la fecha del último pago confirmado. | Tras cada pago confirmado por el operador, el sistema recalcula automáticamente la nueva fecha de vencimiento sumando 365 días. El aviso de 15 días antes se dispara en el día 350 de cada ciclo. |
| **Suspensión** | Vencimiento alcanzado (día 90 del primer ciclo, o día 365 de cualquier ciclo posterior) sin pago confirmado por el operador. | Acceso a la plataforma bloqueado. Sin periodo de gracia adicional — el corte es exacto en la fecha de vencimiento. |
| **Reactivación** | El operador marca el pago como recibido (en cualquier momento, antes o después de la suspensión). | El acceso se restaura inmediatamente si estaba suspendido. La nueva fecha de vencimiento se calcula a partir de la fecha en que se marca el pago, sumando 365 días. |

|  |
| --- |
| **ℹ️ EL PRIMER CICLO ES DE 90 DÍAS, NO DE 365**  El periodo de prueba (90 días) actúa como el primer "ciclo" antes del primer pago — su vencimiento natural es el día 90, no el día 365. A partir del primer pago confirmado, todos los ciclos siguientes son de 365 días. Esto es coherente con la lógica de "siempre 365 días desde el último pago" una vez que existe al menos un pago: antes del primer pago, no hay fecha de pago de la que contar, así que el ciclo se ancla a la fecha de aprobación de la organización. |

# **4. Avisos de Vencimiento Próximo**

## **4.1 Disparador**

El sistema evalúa diariamente la fecha de vencimiento de cada organización activa. Cuando faltan exactamente 15 días para el vencimiento (día 75 del periodo de prueba, o día 350 de cualquier ciclo anual), se genera el aviso automáticamente, una única vez por ciclo.

## **4.2 Aviso al cliente**

| **Canal** | **Contenido** |
| --- | --- |
| Email al Administrador de Organización | Asunto: aviso de próximo vencimiento de la suscripción a Bearingworld.io. Contenido: fecha exacta de vencimiento, importe de la cuota anual, datos bancarios para realizar la transferencia (IBAN, titular, concepto recomendado incluyendo el identificador de la organización para facilitar la conciliación), y una advertencia explícita de que, sin pago confirmado antes de esa fecha, el acceso a la plataforma se suspenderá automáticamente sin periodo de gracia. NOTA v1.1 (QA-BILL-01 cerrada): el email es el único canal por el que se comunican los datos bancarios. No se muestran en ningún banner, pantalla ni componente de la plataforma — es contenido exclusivo de la plantilla de email, sin intervención de la interfaz de usuario. |

## **4.3 Alerta en el panel del Operador**

Además del aviso al cliente, el mismo evento genera una entrada en la cola de cobros pendientes del panel ADMIN-02 (sección 6), visible para el Operador de Plataforma, de forma que el operador disponga de un mecanismo claro para conocer qué organizaciones vencen en los próximos 15 días y pueda anticipar la verificación de las transferencias entrantes.

# **5. Suspensión y Reactivación de Acceso**

## **5.1 Suspensión automática**

Si llega la fecha de vencimiento exacta (día 90 del periodo de prueba, o día 365 de un ciclo anual) sin que el operador haya marcado el pago correspondiente como recibido, el sistema transiciona automáticamente el estado de la organización a SUSPENDED (estado ya existente en la máquina de estados del Módulo 01). No existe periodo de gracia: el corte de acceso es exacto en la fecha de vencimiento, sin margen adicional.

| **Aspecto** | **Comportamiento** |
| --- | --- |
| Acceso de los usuarios | Todos los usuarios de la organización suspendida pierden acceso a las funcionalidades de la plataforma (búsqueda, mensajería, inventario, etc.) al iniciar sesión. |
| Pantalla mostrada | En lugar del dashboard habitual, se muestra una pantalla de suspensión: explica que la suscripción ha vencido, indica que los datos bancarios para regularizar se han enviado por email al administrador (y se reenvían de nuevo en este momento, ver fila siguiente), y que el acceso se restaurará automáticamente en cuanto el pago sea confirmado por el equipo de Bearingworld.io. La pantalla no muestra los datos bancarios directamente. |
| Datos del miembro | Se conservan íntegros (inventario, claves E2EE, historial de mensajería cifrada, favoritos). La suspensión es un bloqueo de acceso, no una eliminación de datos. |
| Visibilidad para otros miembros | El inventario de una organización suspendida deja de aparecer en los resultados de búsqueda de otros miembros mientras dure la suspensión (igual tratamiento que el estado SUSPENDED ya definido en el Módulo 01). |
| Notificación de la suspensión | Email automático al Administrador de Organización en el momento exacto de la transición a SUSPENDED, reiterando los datos bancarios y los pasos para reactivar. |

## **5.2 Reactivación**

Cuando el Operador de Plataforma confirma en el panel ADMIN-02 (sección 6) que ha recibido la transferencia correspondiente, el sistema, en el mismo instante: actualiza la fecha de último pago a la fecha indicada por el operador (o a la fecha de la confirmación, si no se especifica otra), recalcula el nuevo vencimiento sumando 365 días, y transiciona el estado de la organización de SUSPENDED a ACTIVE (o, si no estaba suspendida porque el operador confirmó el pago antes del vencimiento, simplemente actualiza la fecha sin cambiar el estado).

* La reactivación es inmediata — no requiere ninguna acción adicional del Administrador de Organización ni de sus usuarios. La próxima vez que inicien sesión, el acceso está restaurado.
* El Administrador de Organización recibe un email de confirmación: pago registrado, acceso restaurado, próxima fecha de vencimiento.

## **5.3 Borrado tras suspensión prolongada (NUEVO v1.1 — QA-BILL-02 cerrada)**

Una organización puede permanecer en estado SUSPENDED indefinidamente sin que esto tenga, por sí mismo, ningún efecto adicional más allá de la pérdida de acceso (sección 5.1) — no hay borrado automático al suspenderse. Sin embargo, mantener datos de una organización que nunca regulariza su pago no tiene ningún propósito razonable a largo plazo, tanto desde la perspectiva del negocio como de buena práctica de protección de datos. Por ello, V1.1 introduce un mecanismo de borrado para suspensiones muy prolongadas, siempre bajo supervisión manual del operador — nunca automático.

| **Momento** | **Comportamiento del sistema** |
| --- | --- |
| 6 meses continuados en estado SUSPENDED | La organización se marca como "candidata a borrado" y aparece destacada en una sección específica de ADMIN-02 (sección 6.2). El sistema no envía ninguna notificación adicional al cliente en este momento — el cliente ya ha recibido el aviso de vencimiento y la notificación de suspensión (secciones 4 y 5.1). |
| Revisión por el Operador de Plataforma | El operador revisa la lista de candidatas a borrado y decide, caso por caso, si procede al borrado. Esta decisión es siempre manual y explícita — el sistema nunca borra datos por sí mismo, sin importar cuánto tiempo haya pasado. |
| Ejecución del borrado | ACCIÓN IRREVERSIBLE. Requiere confirmación explícita del operador (doble confirmación: marcar la intención y luego confirmar el borrado definitivo). Una vez ejecutado, se eliminan los datos de la organización: inventario, perfil, claves E2EE, y su parte del historial de mensajería. No hay posibilidad de restaurar tras la confirmación. |
| Si la organización paga después de marcarse como candidata pero antes del borrado | Se reactiva con normalidad (sección 5.2) y deja de aparecer como candidata a borrado — los 6 meses se cuentan de nuevo desde cero si vuelve a suspenderse en el futuro. |

|  |
| --- |
| **⚠️ EL BORRADO NUNCA ES AUTOMÁTICO**  A diferencia de la suspensión (que sí es automática al vencer el plazo, sin periodo de gracia — sección 5.1), el borrado de datos tras 6 meses de suspensión es siempre una decisión humana del Operador de Plataforma. El sistema se limita a señalar candidatas; nunca ejecuta el borrado por su cuenta, independientemente de cuánto tiempo adicional transcurra. Esto es deliberado: un borrado de datos de cliente es una acción demasiado sensible para automatizar sin supervisión. |

# **6. Pantalla ADMIN-02 — Panel de Gestión de Cobros**

## **6.1 Descripción**

Nueva sección dentro del panel del Operador de Plataforma (el mismo rol y panel que gestiona la aprobación de organizaciones en ADMIN-01, Módulo 01) dedicada a la gestión manual del ciclo de cobro de todas las organizaciones.

## **6.2 Elementos de la pantalla**

| **Elemento** | **Comportamiento** |
| --- | --- |
| Tabla de organizaciones | Una fila por organización en estado ACTIVE o SUSPENDED. Columnas: Nombre de la organización, Fecha de último pago (o "Sin pagos — periodo de prueba" para quienes aún no han pagado nunca), Fecha de vencimiento, Días restantes (negativo si ya venció), Estado (badge: ACTIVO / AVISO ENVIADO / SUSPENDIDO). |
| Sección "Candidatas a borrado" (NUEVO v1.1) | Lista separada, destacada, de organizaciones que llevan 6 meses o más continuados en SUSPENDED (sección 5.3). Cada una con un botón "Iniciar borrado" que abre el flujo de doble confirmación. |
| Ordenación por defecto | Por días restantes ascendente — las organizaciones más próximas a vencer (o ya vencidas) aparecen primero. |
| Filtro por estado | Permite ver solo: Próximos a vencer (≤15 días), Suspendidos, Candidatas a borrado, o Todos. |
| Cola de avisos enviados (sección destacada) | Lista separada, en la parte superior del panel, de las organizaciones para las que se ha disparado el aviso de 15 días (sección 4.3) y que aún no han sido marcadas como pagadas — es la vista de "cobros pendientes de gestionar esta quincena". |
| Botón "Marcar pago recibido" (por fila) | Abre un formulario simple: fecha del pago (por defecto, la fecha actual, editable), campo de nota interna opcional (ej. referencia de la transferencia). Al confirmar, ejecuta la reactivación (sección 5.2). |
| Ficha de organización (al hacer clic en una fila) | Panel lateral con el historial completo de pagos de esa organización: fechas de cada pago confirmado, quién lo registró (qué operador), y notas internas asociadas a cada uno. |

|  |
| --- |
| **🔐 ACCESO RESTRINGIDO**  Igual que ADMIN-01 (Módulo 01, RNG-11), el acceso a ADMIN-02 está restringido a IPs en whitelist y devuelve 404 si se accede desde fuera de esa lista. Es el mismo perímetro de seguridad ya establecido para el panel de operador. |

# **7. Capa Conversacional VERA en este Módulo**

La interacción de VERA en este módulo es deliberadamente limitada: se trata de información administrativa y financiera sensible, y ninguna acción de este módulo es ejecutable por VERA sin pasar por la pantalla correspondiente.

| **Situación** | **Comportamiento de VERA** |
| --- | --- |
| "¿Cuándo vence mi suscripción?" (Administrador de Organización) | VERA responde con la fecha de vencimiento y los días restantes, consultando el estado de la organización. Es una consulta informativa, sin acción. |
| "¿Cómo pago la suscripción?" | VERA explica el procedimiento (transferencia bancaria) e indica que los datos bancarios se envían exclusivamente por email (en el aviso de vencimiento o en la notificación de suspensión) — VERA no muestra los datos bancarios directamente en el chat, ya que ese contenido vive solo en la plantilla de email (QA-BILL-01 cerrada). |
| "Marca como pagada la organización X" (Operador de Plataforma) | VERA NO ejecuta esta acción directamente sobre el sistema de billing, dado que es una confirmación financiera sensible. Dirige siempre al operador hacia el botón "Marcar pago recibido" en ADMIN-02 para que la acción quede en el flujo de UI estándar, con su formulario de fecha y nota. |
| "¿Qué organizaciones vencen esta semana?" (Operador de Plataforma) | VERA SÍ puede responder esto como consulta informativa de solo lectura, listando las organizaciones de la cola de avisos (sección 6.2) — es equivalente a leer la tabla, no a modificarla. |

# **8. Reglas de Negocio Globales del Módulo**

| **ID** | **Regla** | **Prioridad** |
| --- | --- | --- |
| RNG-BILL-01 | Bearingworld.io no procesa pagos de ningún tipo dentro de la plataforma. El cobro de la suscripción se realiza exclusivamente por transferencia bancaria, gestionada fuera de la plataforma entre el cliente y Bearingworld.io. | **CRÍTICA** |
| RNG-BILL-02 | El periodo de prueba es de 90 días naturales desde la aprobación de la organización (Módulo 01). No es configurable por el cliente ni extensible automáticamente. | **ALTA** |
| RNG-BILL-03 | Todo ciclo de pago posterior al primero es de 365 días desde la fecha del último pago confirmado por el operador, no desde la fecha de vencimiento teórica anterior. | **ALTA** |
| RNG-BILL-04 | El aviso de vencimiento próximo se dispara exactamente 15 días antes de la fecha de vencimiento, una única vez por ciclo, tanto al cliente (email) como al panel del operador (ADMIN-02). | **ALTA** |
| RNG-BILL-05 | No existe periodo de gracia entre el vencimiento y la suspensión. La transición a SUSPENDED es automática e inmediata al alcanzarse la fecha de vencimiento sin pago confirmado. | **CRÍTICA** |
| RNG-BILL-06 | Marcar un pago como recibido es una acción exclusivamente humana del Operador de Plataforma, ejecutada desde ADMIN-02. Ningún proceso automático puede registrar un pago como recibido sin esa acción manual. | **CRÍTICA** |
| RNG-BILL-07 | La suspensión por falta de pago conserva íntegramente los datos del miembro (inventario, claves E2EE, mensajería, favoritos). No implica eliminación ni purga de datos. | **ALTA** |
| RNG-BILL-08 (NUEVO v1.1) | Una organización con 6 meses continuados en estado SUSPENDED se marca como candidata a borrado en ADMIN-02. El borrado de sus datos nunca se ejecuta automáticamente: requiere siempre una acción manual, explícita y con doble confirmación del Operador de Plataforma. | **CRÍTICA** |
| RNG-BILL-09 (NUEVO v1.1) | La regla de "sin periodo de gracia" (RNG-BILL-05) es absoluta: no existe ningún mecanismo para que el Operador de Plataforma aplique una extensión manual puntual del periodo de prueba ni de la fecha de vencimiento. Toda organización, sin excepción, se rige por el mismo cálculo automático de fechas (QA-BILL-03 cerrada). | **ALTA** |

# **9. Criterios de Aceptación por Flujo**

* CA-BILL-01: Una organización recién aprobada (Módulo 01) tiene acceso completo a la plataforma durante 90 días sin ningún requerimiento de pago ni bloqueo.
* CA-BILL-02: El aviso de 15 días antes del vencimiento se genera exactamente una vez por ciclo, tanto por email al administrador como en la cola de ADMIN-02.
* CA-BILL-03: Una organización que alcanza su fecha de vencimiento sin pago confirmado pasa a estado SUSPENDED de forma automática, sin intervención humana y sin margen de gracia.
* CA-BILL-04: Una organización SUSPENDED no aparece en los resultados de búsqueda de otros miembros (Módulo 03) y sus usuarios ven la pantalla de suspensión al iniciar sesión, en lugar del dashboard.
* CA-BILL-05: Al marcar un pago como recibido en ADMIN-02, la organización pasa a ACTIVE inmediatamente (si estaba suspendida) y su fecha de vencimiento se recalcula a 365 días desde la fecha del pago indicada.
* CA-BILL-06: El historial de pagos de una organización (ficha lateral de ADMIN-02) muestra todos los pagos confirmados anteriormente, con fecha y operador que los registró.
* CA-BILL-07: VERA nunca ejecuta directamente la acción de marcar un pago como recibido — siempre dirige al operador hacia el formulario de ADMIN-02.
* CA-BILL-08 (NUEVO v1.1): Una organización que alcanza 6 meses continuados en SUSPENDED aparece en la sección "Candidatas a borrado" de ADMIN-02. El borrado de sus datos requiere doble confirmación explícita del operador y nunca se ejecuta de forma automática, sin importar el tiempo adicional transcurrido.

# **10. Preguntas Abiertas y Decisiones Pendientes**

| **ID** | **Pregunta** | **Propietario** | **Límite** |
| --- | --- | --- | --- |
| **QA-BILL-01 ✅** | Canal de comunicación de los datos bancarios. | — | CERRADA — exclusivamente por email, sin intervención de la plataforma (sección 4.2) |
| **QA-BILL-02 ✅** | Qué ocurre con los datos de una organización suspendida que nunca regulariza. | — | CERRADA — tras 6 meses continuados en SUSPENDED, candidata a borrado bajo supervisión manual del operador (sección 5.3, RNG-BILL-08) |
| **QA-BILL-03 ✅** | Posibilidad de extensiones manuales del plazo por el operador. | — | CERRADA — sin excepciones; "sin periodo de gracia" es absoluto (RNG-BILL-09) |

# **11. Historial de Versiones**

| **Versión** | **Fecha** | **Autor** | **Descripción** |
| --- | --- | --- | --- |
| 1.0 | Junio 2026 | Equipo de Producto | Versión inicial. Especifica el ciclo de vida de la suscripción anual de precio único: periodo de prueba de 90 días, ciclos anuales de 365 días desde el último pago, avisos de vencimiento a 15 días (cliente + operador), suspensión automática sin periodo de gracia, y reactivación manual por el Operador de Plataforma desde el nuevo panel ADMIN-02. Sustituye por completo la integración con Stripe contemplada en el Tech Stack v1.0/v1.1 — Bearingworld.io no procesa pagos de ningún tipo; el cobro se gestiona por transferencia bancaria fuera de la plataforma. |
| 1.1 | Junio 2026 | Equipo de Producto | Cierre de las tres preguntas abiertas: (1) QA-BILL-01 — los datos bancarios se comunican exclusivamente por email, sin mostrarse en ninguna pantalla ni banner de la plataforma. (2) QA-BILL-02 — nueva sección 5.3 y regla RNG-BILL-08: una organización con 6 meses continuados en estado SUSPENDED se marca como candidata a borrado en ADMIN-02, pero el borrado de sus datos nunca es automático — requiere siempre doble confirmación manual del Operador de Plataforma. La suspensión en sí no cambia: sigue conservando los datos íntegros. (3) QA-BILL-03 — confirmado que la regla de "sin periodo de gracia" es absoluta, sin ningún mecanismo de excepción manual (RNG-BILL-09). Añadido CA-BILL-08. |

|  |
| --- |
| **📄 DOCUMENTOS DE REFERENCIA**  PRD v1.0 | Tech Stack & AI Cost Estimation v1.1 (pendiente de actualizar para eliminar el Billing Service basado en Stripe) | Módulo 00 — Arquitectura IA v1.1 | Módulo 01 — Onboarding v1.4 | Módulo 04 — Mensajería E2EE v1.3 (RNG-MSG-08, principio de no procesamiento de pagos) |