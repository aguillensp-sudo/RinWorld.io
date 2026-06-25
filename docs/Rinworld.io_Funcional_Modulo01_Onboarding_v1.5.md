**BEARINGNET COMPETITOR**

**PLATAFORMA**

**ESPECIFICACIÓN FUNCIONAL**

**MÓDULO 01 — ONBOARDING, REGISTRO Y GESTIÓN DE CLAVES E2EE**

Versión 1.5 · Junio 2026 · CONFIDENCIAL

# **1. Propósito y Alcance del Módulo**

Este documento describe con nivel de detalle funcional completo el módulo de Onboarding, Registro y Gestión de Claves E2EE de la plataforma Bearingworld.io. Cubre todos los flujos de usuario, pantallas, reglas de negocio, validaciones y decisiones de diseño relevantes para el desarrollo, QA y aceptación del módulo.

El módulo de Onboarding es la entrada al sistema. Cualquier fallo en su diseño impacta directamente sobre la primera impresión del usuario, la tasa de activación y — de forma crítica — la correcta generación y custodia de las claves criptográficas E2EE, que son el fundamento de la propuesta de valor diferencial de la plataforma.

## **1.1 Objetivos funcionales del módulo**

* Registrar nuevas organizaciones distribuidoras y sus usuarios administradores.
* Verificar la identidad del usuario mediante confirmación de email y, opcionalmente, teléfono.
* Generar el par de claves X25519 (pública / privada) para el nuevo miembro en el dispositivo del usuario, sin que la clave privada salga nunca del navegador en texto plano.
* Establecer y confirmar la Passphrase de Backup — el único mecanismo de recuperación de claves en caso de pérdida del dispositivo.
* Crear el registro cifrado de backup de clave privada en S3/R2 según ADR-001.
* Completar la configuración inicial mínima: perfil de organización, logo, países de operación y preferencias de visibilidad por defecto.
* Gestionar el flujo de invitación de usuarios adicionales dentro de una organización ya registrada.

## **1.2 Fuera de alcance en este módulo**

* Gestión de inventario (Módulo 02).
* Búsqueda y mensajería (Módulos 03 y 04).
* Gestión de suscripción y facturación (Módulo 07).
* Procesos de baja o eliminación de cuenta.

# **2. Actores del Sistema**

| **Actor** | **Descripción** | **Permisos relevantes en este módulo** |
| --- | --- | --- |
| Visitante anónimo | Usuario no autenticado que accede a la página de registro. | Puede iniciar el flujo de registro. No puede acceder a ninguna funcionalidad de la plataforma. |
| Nuevo miembro (admin) | Primer usuario de una organización que completa el registro. Asume automáticamente el rol de Administrador de Organización. | Puede completar el onboarding, configurar el perfil de organización e invitar usuarios adicionales. |
| Usuario invitado | Empleado de una organización ya registrada que acepta una invitación del administrador. | Completa registro personal y generación de claves. No configura el perfil de organización. |
| Administrador de Organización | Miembro con rol Admin dentro de su organización. | Puede invitar usuarios, revocar invitaciones y gestionar claves del equipo. |
| Operador de Plataforma (Administrador Bearingworld.io) | Personal interno de Bearingworld.io con acceso al panel de administración de la plataforma. | ÚNICO actor con capacidad de aprobar o rechazar el alta de nuevas organizaciones. Sin su aprobación, ninguna organización puede activarse. No puede ver claves privadas (imposible por arquitectura E2EE). |

# **3. Flujos de Usuario Principales**

## **3.1 Visión general de los flujos**

| **ID Flujo** | **Nombre** | **Actor** | **Descripción corta** |
| --- | --- | --- | --- |
| FL-00 | Aprobación de organización por operador | Operador de Plataforma | Solo aplica a la Ruta 00.2 (usuario desconocido). El operador revisa el FSR y decide aprobar o rechazar. Los usuarios que llegan por invitación directa (Ruta 00.1) no pasan por este flujo — su aprobación es automática. |
| FL-01 | Registro de nueva organización | Visitante anónimo / Cliente potencial invitado | Proceso de alta de una organización en la plataforma. Tiene dos rutas de entrada: 00.1 (invitado conocido, aprobación automática) y 00.2 (desconocido, aprobación manual por operador). Tras la aprobación (por cualquiera de las dos vías), el flujo continúa con el FRO (formulario unificado), generación de claves E2EE y acceso al dashboard. |
| FL-01-FSR | Formulario de Solicitud de Registro (FSR) | Cliente desconocido | Solo Ruta 00.2. Formulario ligero previo al registro completo: recoge los datos mínimos para que el operador pueda evaluar la solicitud. Si el operador aprueba, el flujo continúa con FL-01. |
| FL-03 | Generación y backup de claves E2EE | Nuevo miembro / Usuario invitado | Generación del par X25519 en el navegador y cifrado del backup con Argon2id + AES-256-GCM. |
| FL-04 | Invitación de usuario adicional | Administrador de Organización | El admin invita a un empleado. El empleado completa registro personal y generación de claves. |
| FL-05 | Recuperación de clave en nuevo dispositivo | Cualquier usuario autenticado | El usuario introduce la backup passphrase para restaurar su clave privada en IndexedDB. |
| FL-06 | Cambio de backup passphrase | Cualquier usuario autenticado | Re-cifrado de la clave privada con nueva wrapping key derivada de la nueva passphrase. |

## **3.2 FL-01: Registro de Nueva Organización**

### **3.2.1 Descripción del flujo**

El flujo FL-01 tiene dos rutas de entrada distintas (Ruta 00.1 y Ruta 00.2), que convergen en un proceso unificado a partir del momento en que el usuario está autorizado a registrarse. La verificación de email como paso intermedio queda eliminada — el modelo es más simple y menos friccionante para el usuario.

### **3.2.2 Ruta 00.1 — Usuario invitado conocido**

El Administrador de la Plataforma tiene el email del potencial cliente y le envía una invitación directa personalizada. El enlace de esa invitación lleva al usuario directamente al FRO (sección 3.2.4) sin pasar por el FSR ni por aprobación manual del operador. La aprobación es automática por el hecho de haber recibido la invitación.

| **Paso** | **Actor** | **Acción** | **Resultado** |
| --- | --- | --- | --- |
| 00.1 | Admin Plataforma | Envía email de invitación personalizado al cliente potencial con enlace único de registro. | Email entregado. El enlace incluye un token de invitación que identifica al destinatario y activa la aprobación automática. |
| 00.1.1 | Cliente potencial | Pulsa el enlace de la invitación. | El sistema valida el token de invitación. Estado interno: INVITED\_APPROVED. Redirige directamente al FRO (paso 01.1 — sección 3.2.4). |
| 00.1.2 | Sistema | Registra la solicitud con aprobación automática. No requiere intervención del operador. | El usuario puede proceder inmediatamente al FRO con los campos vacíos (la invitación no pre-rellena datos de organización — sección 3.2.4). |

### **3.2.3 Ruta 00.2 — Usuario desconocido**

Un usuario que no ha sido invitado llega a la plataforma desde la web y pulsa el botón "Solicitud de Registro". Pasa primero por el FSR (Formulario de Solicitud de Registro), un formulario ligero que recoge los datos mínimos para que el operador evalúe si la organización pertenece al sector. Solo si el operador aprueba, el usuario puede continuar al FRO.

| **Paso** | **Actor** | **Acción** | **Resultado** |
| --- | --- | --- | --- |
| 00.2 | Cliente desconocido | Pulsa el botón "Solicitud de Registro" en la web. | El sistema muestra el FSR (pantalla REG-00 — sección 3.2.3.1). |
| 00.2.1 | Cliente desconocido | Rellena y envía el FSR con los datos mínimos. | El sistema registra la solicitud y la muestra en el panel del operador (ADMIN-01). Estado: PENDING\_REVIEW. |
| 00.2.2 | Operador de Plataforma | Revisa la solicitud en ADMIN-01 y aprueba o rechaza. | Si aprueba: estado INVITED\_APPROVED; el sistema envía un email al usuario con un enlace personalizado al FRO, equivalente al de la Ruta 00.1. Si rechaza: estado REJECTED; el usuario recibe EML-08 con el motivo. |
| 00.2.3 | Cliente potencial | Pulsa el enlace recibido por email tras la aprobación. | El sistema valida el token. Redirige al FRO (paso 01.1 — sección 3.2.4) con los campos del FSR pre-rellenados (nombre empresa, país, etc.). |

|  |
| --- |
| **📋 FSR — FORMULARIO DE SOLICITUD DE REGISTRO (solo Ruta 00.2)**  El FSR (pantalla REG-00) recoge: email del solicitante, nombre y apellidos, nombre de la organización, país de la organización, teléfono de contacto, y sitio web. Es intencionalmente ligero — su único propósito es dar al operador los datos suficientes para decidir si la organización pertenece al sector de distribución de rodamientos y transmisión de potencia. No sustituye al FRO, que es el formulario completo de registro. |

### **3.2.4 FRO — Formulario de Registro de Organización y Administrador (paso 01.1)**

| **Fase** | **Nombre** | **Pantallas involucradas** | **Salida esperada** |
| --- | --- | --- | --- |
| Fase A | FRO — Datos de organización y administrador | REG-01 (rediseñado — sección 3.2.5) | Registro completo en base de datos. Estado: REGISTERED. Si la ruta es 00.2, los datos del FSR se pre-rellenan en los campos correspondientes. |
| Fase B | Generación de claves E2EE y backup passphrase | REG-05, REG-06, REG-07 | Par de claves generado. Backup cifrado almacenado en S3. Estado KEY\_ACTIVE. |
| Fase C | Configuración inicial de organización y acceso al dashboard | REG-08, REG-09 | Perfil de organización completo. Estado ACTIVE. Usuario redirigido al dashboard. |

### **3.2.5 Pantalla REG-01 — FRO (Formulario de Registro de Organización y Administrador)**

**Descripción**

Formulario único que recoge todos los datos necesarios para crear la organización y el usuario administrador en una sola pantalla, organizada en dos secciones visualmente diferenciadas. Es la única pantalla de datos del proceso de registro: sustituye a la antigua REG-01 (datos de usuario) + REG-08 (perfil de organización), que quedan unificadas. Si el usuario llega por la Ruta 00.2, los campos coincidentes con el FSR (nombre organización, país, teléfono, web) aparecen pre-rellenados y son editables.

**Sección 1 de 2 — Datos de la organización**

| **Campo / Elemento** | **Tipo** | **Obligatorio** | **Validación / Regla** |
| --- | --- | --- | --- |
| Nombre legal de la empresa | Text input | Sí | Mínimo 2 caracteres, máximo 120. No permite solo espacios. Pre-rellenado desde FSR si Ruta 00.2. |
| Número de identificación fiscal (NIF/CIF) | Text input | Sí (NUEVO) | Identificador fiscal de la empresa. Sin validación de formato específico por país en V1 — solo obligatoriedad de no estar vacío. No se publica en el Directorio ni en la ficha pública; es un dato interno de verificación. |
| Dirección | Text input | Sí | Dirección postal completa de la organización. Máximo 200 caracteres. Se muestra en la ficha pública y en el Directorio de Organizaciones (Módulo 04). |
| Código postal | Text input | Sí | Sin validación de formato (los formatos varían por país). Se muestra junto a la dirección en la ficha pública y en el Directorio. |
| País de sede | Select (dropdown) | Sí | Lista ISO 3166-1 completa. Pre-rellenado desde FSR si Ruta 00.2. El valor seleccionado establece el prefijo por defecto del teléfono. |
| Email de contacto público | Email input | Sí | Formato de email válido. Puede coincidir con el email del administrador o ser una dirección comercial genérica (ventas@empresa.com). Se publica en el Directorio y en la ficha pública (Módulo 04, MSG-04 y MSG-05) — es la vía de contacto directo visible para todos los miembros. |
| Teléfono de contacto público | Dos sub-campos: prefijo de país (select) + número (text input) | Sí | Prefijo de país: selector con prefijos internacionales habituales, valor por defecto vinculado al País de sede seleccionado (editable). Número: texto libre, solo dígitos, espacios y guiones. Se publica en el Directorio y en la ficha pública. Pre-rellenado desde FSR si Ruta 00.2. |
| Sitio web corporativo | URL input | No | Si se introduce, debe ser una URL válida con https://. Se mostrará en la ficha pública y en el Directorio. |
| Países de operación | Multi-select con búsqueda | Sí (mínimo 1) | Lista ISO 3166-1. El país de sede aparece preseleccionado. El usuario puede añadir más. |
| Marcas principales que distribuye | Tags input (texto libre) | No | El usuario escribe un nombre de marca y pulsa Enter para añadirlo como tag. Máximo 20 marcas. Sugerencias autocompletadas con la lista de fabricantes conocidos. |
| Logo de la empresa | File upload (imagen) | No | Formatos: PNG, JPG, WEBP. Tamaño máximo: 2 MB. Si no se sube, se usa un avatar generado con las iniciales de la empresa. |
| Visibilidad del inventario | Radio group | Sí | Visible para todos los miembros (defecto) / Visibilidad restringida (Módulo 02 v1.3 — ver sección de visibilidad para el detalle de configuración de exclusiones). Modificable posteriormente. |

**Sección 2 de 2 — Datos del usuario administrador**

| **Campo / Elemento** | **Tipo** | **Obligatorio** | **Validación / Regla** |
| --- | --- | --- | --- |
| Nombre completo del administrador | Text input | Sí | Mínimo 2 caracteres, máximo 100. Pre-rellenado desde FSR si Ruta 00.2. |
| Email del administrador | Email input | Sí | Formato de email válido. Verificación de unicidad en tiempo real (debounce 800ms). Si ya existe: "Este email ya está registrado. ¿Quieres iniciar sesión?" Pre-rellenado desde FSR si Ruta 00.2. |
| Contraseña | Password input (con toggle mostrar/ocultar) | Sí | Mínimo 10 caracteres. Requiere al menos: 1 mayúscula, 1 minúscula, 1 número, 1 carácter especial. Indicador visual de fortaleza (4 niveles). No se permite avanzar con nivel < Aceptable. |
| Repetir contraseña | Password input | Sí | Debe coincidir exactamente con el campo anterior. Validación en tiempo real. |
| Acepto los Términos y Condiciones y la Política de Privacidad | Checkbox | Sí | Bloquea el botón de continuar si no está marcado. |
| Botón "Registrar organización" | Primary button | — | Deshabilitado hasta que todos los campos obligatorios sean válidos. Al pulsar: POST /api/auth/register. Redirige a Fase B (E2EE). |
| Botón "Continuar con Google" (solo sección admin) | OAuth button | — | Inicia flujo OAuth 2.0 con Google para el usuario administrador. La contraseña no es necesaria para usuarios SSO. La Passphrase de Backup E2EE sigue siendo obligatoria en Fase B. |
| Enlace "Ya tengo cuenta — Iniciar sesión" | Text link | — | Redirige a /login. |

|  |
| --- |
| **ℹ️ FRO UNIFICADO — ELIMINACIÓN DE REG-02, REG-03 y REG-04 (v1.4)**  En la v1.3, el proceso de registro incluía: REG-01 (datos usuario), REG-02 (confirmación antes de enviar), REG-03 (pantalla de espera de verificación de email), y REG-04 (pantalla destino del enlace de verificación). En v1.4 estos pasos se eliminan: (1) REG-02 se elimina porque el FRO unificado permite editar cualquier campo antes de pulsar "Registrar organización" — no hace falta una pantalla de confirmación adicional. (2) REG-03 y REG-04 se eliminan porque la verificación por enlace de email desaparece del flujo — se consideraba un paso de fricción innecesaria que complicaba la experiencia sin un beneficio proporcional para el tipo de usuarios del sector. El único mecanismo de validación de email que permanece es la validación de formato en tiempo real en el propio FRO. |

|  |
| --- |
| **📇 CONTACTO PÚBLICO vs. CREDENCIALES DE ACCESO**  El email de contacto público y el teléfono de contacto público (nuevos campos obligatorios) son datos comerciales de la organización, pensados para mostrarse en el Directorio de Organizaciones y en la ficha pública de cada miembro (Módulo 04, "páginas amarillas" del sector). Son conceptualmente distintos del email del administrador (credencial de acceso/login, Módulo 01) y de las claves E2EE (Módulo 01, Fase C): una organización puede publicar un email comercial genérico (ventas@empresa.com) distinto del email personal con el que su administrador inició sesión. Estos datos de contacto público son visibles para todos los miembros de la plataforma sin restricción — la plataforma no obliga a canalizar el primer contacto exclusivamente a través de la mensajería E2EE del Módulo 04; si dos organizaciones prefieren establecer contacto por teléfono o email directo, es su decisión. |

**Reglas de negocio REG-01**

* RN-01.1: El email del administrador es el identificador único del usuario en toda la plataforma. No puede ser reutilizado ni por otras organizaciones.
* RN-01.2: La contraseña se hashea con bcrypt (cost factor 12) en el servidor. Nunca se almacena en texto plano ni se envía en logs.
* RN-01.3: La combinación [nombre empresa + país] no se valida como única en el registro. Es responsabilidad del operador revisar duplicados si se activa el proceso de validación manual.
* RN-01.4: Si el dominio del email corporativo ya existe registrado en la plataforma bajo otra organización, el sistema muestra un aviso no bloqueante: "Existen otros usuarios de tu empresa en la plataforma. Si quieres unirte a su organización, pide a tu administrador que te invite."
* RN-01.5: Los usuarios que se registran con Google SSO no tienen contraseña en la plataforma. Su identidad es gestionada por Google. Sin embargo, deben configurar una Passphrase de Backup E2EE independiente del método de login. Esta passphrase no puede ser recuperada por Google ni por Bearingworld.io.
* RN-01.6: Si un email ya registrado en la plataforma (formulario clásico) intenta registrarse con Google SSO con el mismo email, el sistema lo reconoce como la misma cuenta y ofrece vincular el acceso con Google. No crea una cuenta duplicada.
* RN-01.7 (NUEVO v1.3): El email y el teléfono de contacto público son obligatorios para completar el registro — no se valida su unicidad (a diferencia del email del administrador, RN-01.1), solo su formato. Ambos campos son editables posteriormente desde Ajustes → Datos de la organización, y se reflejan automáticamente en el Directorio de Organizaciones y en la ficha pública (Módulo 04) tras cualquier edición.
* RN-01.8 (NUEVO v1.4): El rol de un usuario no es un campo editable ni seleccionable en ningún formulario. El primer usuario que completa el registro de una organización (a través del FRO) asume automáticamente el rol de Administrador. Todos los usuarios adicionales — ya sea añadidos inmediatamente tras el FRO (REG-09) o invitados posteriormente desde INVT-01 — asumen automáticamente el rol de Editor, sin excepción y sin posibilidad de elegir o cambiar este valor desde ningún formulario de registro o invitación.
* RN-01.9 (NUEVO v1.4): El número de identificación fiscal (NIF/CIF) de la organización es un campo obligatorio del FRO. No se valida su formato en V1 (varía por país y jurisdicción), solo su presencia. Es un dato interno de verificación, no se publica en el Directorio ni en la ficha pública de la organización.

## **3.2B FL-00: Aprobación de Organización por el Operador de Plataforma (solo Ruta 00.2)**

### **3.2B.1 Descripción del flujo**

Este es el flujo más crítico del módulo desde el punto de vista de la seguridad de la comunidad. El Operador de Plataforma (administrador de Bearingworld.io) es el único actor autorizado para activar nuevas organizaciones. El objetivo es garantizar que solo accedan empresas que pertenecen genuinamente al sector de distribución de rodamientos y transmisión de potencia.

|  |
| --- |
| **🎯 PRINCIPIO RECTOR**  La activación de un usuario es SIEMPRE un acto humano y manual. No existe ningún mecanismo automático que active una cuenta sin intervención del Operador de Plataforma. Este diseño es intencional y protege la calidad y la credibilidad de la red. Un distribuidor de rodamientos acepta pagar por una plataforma donde sabe que todos los miembros son pares reales del sector. |

### **3.2B.2 Pantalla REG-00-WAIT — Espera de aprobación del operador (solo Ruta 00.2)**

Pantalla que se muestra al usuario inmediatamente después de enviar el FSR, mientras espera la revisión del operador. Solo aplica a la Ruta 00.2 (usuario desconocido). Los usuarios de la Ruta 00.1 (invitados) no ven esta pantalla — son redirigidos directamente al FRO (REG-01).

| **Elemento** | **Comportamiento** |
| --- | --- |
| Mensaje principal | "Hemos recibido tu solicitud. Nuestro equipo está revisando tu solicitud de acceso a Bearingworld.io. Recibirás un email de confirmación en un plazo de 1-2 días hábiles." |
| Información de contexto | Explicación breve de por qué existe este paso: "Bearingworld.io es una red exclusiva para distribuidores profesionales de rodamientos y transmisión de potencia. Verificamos cada solicitud para garantizar la calidad de la comunidad." |
| Estado visual | Indicador de progreso de 3 pasos: (1) Solicitud enviada ✓ / (2) Revisión en curso (activo, animado) / (3) Acceso activado (pendiente). |
| Polling de estado | La pantalla hace polling cada 60 segundos a GET /api/auth/approval-status. Si el operador aprueba, redirige automáticamente al FRO (REG-01) con un mensaje: "¡Tu solicitud ha sido aprobada! Continuemos con el registro de tu organización." |
| Contacto de soporte | Enlace discreto: "¿Tienes alguna pregunta? Escríbenos a soporte@bearingworld.io" |

|  |
| --- |
| **ℹ️ PANTALLA DE UN SOLO USO (NUEVO v1.4)**  REG-00-WAIT solo es visible para el usuario en la sesión temporal asociada a su solicitud (token de seguimiento del FSR), no requiere una cuenta completa con credenciales — el usuario aún no tiene email/contraseña en este punto del flujo. En cuanto la solicitud se resuelve (aprobada o rechazada) y el usuario abandona o cierra esta pantalla, deja de ser accesible: no existe ninguna URL ni mecanismo para volver a consultarla después. Si el usuario quiere conocer el estado de una solicitud ya resuelta, debe seguir el enlace recibido por email (aprobación) o esperar el email de rechazo (EML-08), no volver a esta pantalla. |

### **3.2B.3 Pantalla ADMIN-01 — Panel de aprobación del operador**

Panel exclusivo del Operador de Plataforma. Accesible únicamente con credenciales de operador. No es accesible para ningún miembro de la plataforma, incluidos los Administradores de Organización.

| **Elemento** | **Comportamiento** |
| --- | --- |
| Cola de solicitudes pendientes | Lista ordenada por antigüedad (más antigua primero) de solicitudes de registro (FSR enviados) en estado PENDING\_REVIEW. Columnas: Nombre empresa, País, Email solicitante, Teléfono, Sitio web, Fecha solicitud, Antigüedad en cola. |
| Indicador de urgencia | Las solicitudes con más de 48h en cola se destacan con fondo ámbar. Las de más de 7 días con fondo rojo. El operador recibe EML-OP-02 automático a las 48h. |
| Ficha de solicitud | Al hacer clic en una solicitud: panel lateral con los datos del FSR: nombre empresa, país, sitio web (con botón para abrirlo), nombre del solicitante, email, teléfono, fecha y hora de envío del FSR, historial de cambios de estado. |
| Herramientas de verificación | Accesos rápidos para el operador: botón "Buscar en LinkedIn", botón "Buscar en Google", botón "Verificar dominio web". Estos abren el recurso en nueva pestaña. El operador hace su propia verificación manualmente. |
| Botón "Aprobar" | Cambia el estado a APPROVED. Activa el envío automático de EML-07 al usuario. El operador puede añadir una nota interna opcional antes de aprobar (visible solo en el panel de admin, nunca al usuario). |
| Botón "Rechazar" | Abre un modal con: campo de motivo del rechazo (obligatorio, texto libre, máx 500 caracteres), vista previa del email EML-08 que recibirá el usuario, y botón de confirmación. El motivo se envía al usuario en EML-08 y queda registrado en el historial. |
| Historial de decisiones | Log de todas las organizaciones procesadas: aprobadas, rechazadas, fecha, operador que tomó la decisión. Filtrable por estado y fechas. Exportable en CSV. |

### **3.2B.4 Reglas de negocio FL-00**

* RN-FL00.1: Este flujo (FL-00) solo se activa para la Ruta 00.2 (usuario desconocido que envió un FSR). Los usuarios de la Ruta 00.1 (invitados con enlace directo del operador) tienen aprobación automática implícita por el hecho de haber recibido el enlace de invitación — no pasan por ADMIN-01 ni por ningún paso de FL-00.
* RN-FL00.2: El operador que aprueba o rechaza queda registrado en el log con su ID de usuario y timestamp. Toda decisión es trazable.
* RN-FL00.3: Un rechazo no es definitivo. El operador puede revertir un REJECTED a PENDING\_REVIEW para re-revisión si el solicitante aporta información adicional por email de soporte.
* RN-FL00.4: El motivo del rechazo es visible para el usuario en EML-08. El operador debe ser claro y profesional. No se envían motivos que contengan información interna de la plataforma.
* RN-FL00.5: Las solicitudes FSR en estado PENDING\_REVIEW sin revisión durante 30 días pasan automáticamente a CANCELLED con notificación al solicitante. El operador puede reactivarlas manualmente si lo considera oportuno.
* RN-FL00.6: El Operador de Plataforma no puede ver ni las claves privadas de los usuarios (imposible por arquitectura) ni el contenido de las negociaciones cifradas (E2EE). Su rol de aprobación es sobre la identidad y legitimidad de la organización, no sobre su actividad comercial.

|  |
| --- |
| **💡 CRITERIOS ORIENTATIVOS DE APROBACIÓN**  El documento de política de aprobación (a elaborar antes de lanzamiento) debe definir los criterios concretos. Como orientación inicial: Aprobar si el sitio web o LinkedIn de la empresa muestran actividad en distribución de rodamientos o transmisión de potencia. Rechazar si la empresa no tiene presencia verificable en el sector, si el email es de dominio genérico (gmail, hotmail) sin sitio web corporativo asociado, o si hay indicios de empresa ficticia. El criterio no es el tamaño de la empresa sino su pertenencia real al sector. |

## **3.3 FL-03: Generación de Claves E2EE y Backup Passphrase**

### **3.3.1 Descripción del flujo**

Este flujo es el núcleo diferencial del módulo. Toda la operación criptográfica ocurre exclusivamente en el navegador del usuario. El servidor nunca recibe la clave privada ni la backup passphrase en ningún momento del proceso.

|  |
| --- |
| **🔒 GARANTÍA MATEMÁTICA E2EE**  La clave privada X25519 se genera con crypto.getRandomValues() en el browser. Nunca sale del dispositivo en texto plano. El servidor almacena únicamente un blob cifrado con AES-256-GCM cuya clave de cifrado (wrapping key) se deriva de la backup passphrase del usuario con Argon2id. Sin la passphrase, el blob es computacionalmente indistinguible de datos aleatorios. |

### **3.3.2 Pantalla REG-05 — Introducción a las claves E2EE**

**Descripción**

Pantalla explicativa antes de la generación de claves. El objetivo es que el usuario comprenda qué va a ocurrir y por qué, antes de entrar en el proceso técnico. El lenguaje debe ser accesible (el usuario tipo tiene 50+ años, background en distribución, no en tecnología).

**Contenido de la pantalla**

* Titular: "Tu privacidad está garantizada matemáticamente"
* Explicación en 3 puntos visuales:
  + "Vamos a crear una clave criptográfica única para ti. Solo tú la tendrás."
  + "Los precios y negociaciones que intercambies en la plataforma viajarán cifrados. Ni nosotros ni nadie más puede leerlos."
  + "Para protegerte si cambias de dispositivo, te pediremos que elijas una Passphrase de Backup. Es como la llave de una caja fuerte — si la pierdes, nadie puede abrirla por ti."
* CTA: Botón "Entendido — Generar mis claves" → navega a REG-06.
* Enlace opcional: "¿Cómo funciona esto?" → abre modal con explicación técnica expandida (para usuarios curiosos).

### **3.3.3 Pantalla REG-06 — Establecer Backup Passphrase**

**Descripción**

El usuario elige la passphrase que se usará para cifrar su clave privada. Esta pantalla es BLOQUEANTE: no existe opción de "omitir" o "más tarde". La passphrase es el único mecanismo de recuperación y debe configurarse antes de que la clave privada se genere.

**Elementos de la pantalla**

| **Campo / Elemento** | **Tipo** | **Regla** |
| --- | --- | --- |
| Backup Passphrase | Password input (con toggle mostrar/ocultar) | Evaluada con zxcvbn. El indicador visual muestra: Muy débil (rojo) / Débil (naranja) / Aceptable (amarillo) / Fuerte (verde) / Muy fuerte (verde oscuro). El botón de continuar solo se habilita con puntuación ≥ 3 (Fuerte). Mínimo absoluto: 12 caracteres. |
| Repetir Backup Passphrase | Password input | Debe coincidir exactamente. Validación en tiempo real con mensaje "Las passphrases no coinciden" en rojo bajo el campo. |
| Indicador de fortaleza | Barra de progreso + texto descriptivo | Generado por zxcvbn. Muestra también el tiempo estimado de crackeo: p.ej. "Resistente durante más de 100 años". |
| Aviso crítico | Banner destacado | Texto: "Esta passphrase NO es tu contraseña de acceso. Si la pierdes, tu historial cifrado será permanentemente inaccesible. No la almacenes en el mismo sitio que tu contraseña." Checkbox de confirmación requerido. |
| Sugerencia | Texto informativo | "Una buena passphrase son 4-5 palabras sin relación entre sí. Ejemplo: café montaña túnel espiral verde." |
| Botón "Continuar" | Primary button | Habilitado solo si: passphrase ≥ fortaleza mínima + coinciden + checkbox confirmación marcado. |

|  |
| --- |
| **⚠ REGLA DE DISEÑO CRÍTICA**  La backup passphrase DEBE ser diferente a la contraseña de login (RN-06.1). El sistema debe detectar y bloquear el caso en que ambas sean idénticas, mostrando el mensaje: "La passphrase de backup debe ser diferente a tu contraseña de acceso. Esto es una medida de seguridad: si alguien obtiene tu contraseña, no podrá acceder a tu historial cifrado." |

### **3.3.4 Pantalla REG-07 — Generación de claves y almacenamiento de backup**

**Descripción**

Pantalla de progreso que muestra al usuario que el proceso criptográfico está ocurriendo. Toda la operación es asíncrona y ocurre en un Web Worker para no bloquear el hilo principal de la UI.

**Pasos del proceso (visibles al usuario con indicadores de progreso)**

| **Paso** | **Descripción visible al usuario** | **Operación técnica en background** |
| --- | --- | --- |
| 1/4 | Generando tu par de claves... | crypto.getRandomValues() → par X25519 vía WebCrypto API. |
| 2/4 | Derivando clave de protección... | Argon2id(passphrase, salt\_32bytes, m=65536, t=3, p=4) → 32-byte wrapping key. ~500ms–1s en hardware moderno. |
| 3/4 | Cifrando clave de backup... | AES-256-GCM(wrapping\_key, iv\_12bytes, aad=member\_id) sobre la clave privada X25519 → 48 bytes de ciphertext. |
| 4/4 | Guardando backup seguro en servidor... | POST /api/identity/key-backup con { encrypted\_key\_blob, key\_iv, argon2\_salt, kdf\_params }. La passphrase y wrapping\_key NO se incluyen en el payload. |

**Reglas de negocio REG-07**

* RN-07.1: Si el POST /api/identity/key-backup falla por error de red, el sistema reintenta automáticamente hasta 3 veces con backoff exponencial (1s, 2s, 4s). Si persiste el fallo, muestra mensaje de error y botón "Reintentar". El usuario NO debe ser redirigido a REG-06 — la passphrase permanece en memoria del Web Worker hasta el éxito.
* RN-07.2: Una vez el backup se almacena correctamente, la passphrase y la wrapping key son eliminadas de memoria. La clave privada se almacena en IndexedDB del navegador bajo la clave member\_private\_key\_{member\_id}.
* RN-07.3: La clave pública se registra en el servidor: POST /api/identity/public-key con { public\_key\_base64 }. Esta clave es visible para otros miembros (necesaria para cifrar mensajes dirigidos a este usuario).
* RN-07.4: Tras la finalización exitosa de los 4 pasos, el estado del miembro se actualiza a KEY\_ACTIVE.

|  |
| --- |
| **💡 NOTA DE IMPLEMENTACIÓN**  Los pasos 1-3 deben ejecutarse en un Web Worker para no bloquear la UI. El paso 4 (POST al servidor) puede ejecutarse en el hilo principal o en el worker. El indicador de progreso debe actualizarse vía postMessage desde el worker. Esto es especialmente relevante para el paso 2 (Argon2id), que puede tomar hasta 1 segundo en dispositivos lentos. |

## **3.4 Fase C — Acceso al Dashboard y Registro de Usuarios Adicionales**

|  |
| --- |
| **ℹ️ REG-08 ELIMINADA COMO PANTALLA SEPARADA (v1.4)**  En versiones anteriores, REG-08 era una pantalla de "perfil de organización" que el usuario completaba tras las claves E2EE. En v1.4, todos esos datos (países de operación, marcas, logo, visibilidad de inventario, dirección, teléfono, email de contacto) se recogen en el FRO unificado (REG-01, Fase A). REG-08 desaparece como pantalla de flujo. Los datos del perfil de organización siguen siendo editables en cualquier momento desde Ajustes → Datos de la organización. |

### **3.4.1 Pantalla REG-09 — Bienvenida, usuarios adicionales y acceso al dashboard**

**Descripción**

Pantalla de éxito que confirma la finalización del onboarding y ofrece al usuario los próximos pasos sugeridos.

**Elementos de la pantalla**

* Mensaje de bienvenida personalizado: "¡Bienvenido a Bearingworld.io, [nombre del usuario]! Tu cuenta y la de [nombre empresa] están listas."
* Resumen de lo que acaba de configurar: claves E2EE activas, backup guardado, perfil de organización creado.
* Pregunta sobre usuarios adicionales: "¿Deseas registrar más usuarios para tu organización ahora?" con dos opciones: [Sí, añadir usuario] / [No, ir al dashboard].
  + Si el usuario elige "Sí, añadir usuario": se lanza el FRU (Formulario de Registro de Usuario, NUEVO v1.4 — formulario separado y simplificado, sin ningún campo de organización), que solicita únicamente los datos del usuario adicional: nombre, email, contraseña, confirmar contraseña, aceptar Términos y Condiciones. El rol se asigna automáticamente como Editor — no es un campo seleccionable (RN-01.8, sección 3.2.5). El proceso es iterativo: al finalizar el registro de cada usuario adicional, se vuelve a preguntar si desea añadir otro, hasta alcanzar el límite de 5 usuarios por organización (RNG-09). Al llegar al límite o al elegir "No", se redirige al dashboard.
* Si el usuario elige "No, ir al dashboard": se redirige a /dashboard directamente.
* Panel de "Próximos pasos" (visible en el dashboard tras el onboarding, no en esta pantalla): subir primer inventario, hacer primera búsqueda, invitar más usuarios.
* Recordatorio sutil (no bloqueante): "¿Quieres también guardar tu backup en Google Drive o iCloud? Puedes hacerlo en Ajustes → Seguridad en cualquier momento." (Opción B del ADR-001)

### **3.4.2 Pantalla FRU — Formulario de Registro de Usuario Adicional (NUEVO v1.4)**

**Descripción**

Formulario simplificado para registrar un usuario adicional dentro de una organización ya existente. Se lanza tanto desde REG-09 (justo tras completar el onboarding del primer usuario) como desde el flujo de invitación por email (FL-04, sección 3.5) cuando el invitado hace clic en el enlace recibido. Deliberadamente separado del FRO: no contiene ningún campo de organización, ni siquiera en modo solo lectura o deshabilitado — el usuario invitado ya pertenece a una organización existente y no necesita ver ni confirmar sus datos.

**Elementos de la pantalla**

| **Campo / Elemento** | **Tipo** | **Obligatorio** | **Validación / Regla** |
| --- | --- | --- | --- |
| Nombre completo | Text input | Sí | Mínimo 2 caracteres, máximo 100. |
| Email | Email input | Sí | Formato de email válido. Verificación de unicidad en tiempo real, igual que en el FRO (RN-01.1). |
| Contraseña | Password input (con toggle mostrar/ocultar) | Sí | Misma política que el FRO: mínimo 10 caracteres, 1 mayúscula, 1 minúscula, 1 número, 1 carácter especial. |
| Repetir contraseña | Password input | Sí | Debe coincidir exactamente con el campo anterior. |
| Acepto los Términos y Condiciones y la Política de Privacidad | Checkbox | Sí | Bloquea el botón de continuar si no está marcado. |
| Botón "Crear mi cuenta" | Primary button | — | Deshabilitado hasta que todos los campos sean válidos. Al pulsar: POST /api/auth/register-additional-user. Redirige a la Fase B (claves E2EE, REG-05), igual que el flujo del FRO. |

|  |
| --- |
| **🚫 SIN CAMPOS DE ORGANIZACIÓN — NI SIQUIERA DESHABILITADOS**  El FRU no muestra el nombre de la organización, su dirección, NIF/CIF, ni ningún otro dato de empresa, ni siquiera en modo de solo lectura. El usuario adicional pertenece automáticamente a la organización de quien lo invitó (administrador) o de quien completó el FRO inicial — esa asociación se resuelve por el contexto de la invitación o de la sesión activa de REG-09, no por ningún campo que el usuario deba ver o confirmar. El rol se asigna automáticamente como Editor, sin ningún selector (RN-01.8). |

## **3.5 FL-04: Invitación de Usuario Adicional**

### **3.5.1 Descripción del flujo**

Un Administrador de Organización puede invitar a miembros adicionales de su empresa. El usuario invitado completa solo el FRU (sección 3.4.2 — registro personal, sin datos de empresa) y la generación de claves E2EE. Comparte la organización del administrador que lo invitó.

### **3.5.2 Pantalla INVT-01 — Panel de gestión de invitaciones**

**Descripción**

Accesible desde Ajustes → Equipo. Muestra la lista de usuarios activos de la organización y las invitaciones pendientes.

**Elementos de la pantalla**

| **Sección** | **Contenido** |
| --- | --- |
| Usuarios activos | Tabla con: nombre, email, rol (Administrador / Editor — no editable desde aquí, ver RN-01.8), fecha de alta, estado de backup E2EE (Configurado / No configurado). Botón de revocación de acceso por usuario. |
| Invitaciones pendientes | Tabla con: email invitado, fecha de envío, fecha de expiración (7 días), estado (Pendiente / Aceptada / Expirada). Botón de reenvío (una vez transcurridas 24h). Botón de cancelación. |
| Formulario de nueva invitación | Campo email + Botón "Enviar invitación". Sin selector de rol — el usuario invitado se asigna automáticamente como Editor (RN-01.8). POST /api/org/invite. |

**Reglas de negocio FL-04**

* RN-INV.1: Un email ya registrado en la plataforma (aunque sea de otra organización) no puede ser invitado. El sistema detecta esto en tiempo real y muestra: "Este usuario ya tiene una cuenta en la plataforma."
* RN-INV.2: El token de invitación expira en 7 días. Tras la expiración, el administrador debe reenviar la invitación.
* RN-INV.3: El límite de usuarios por organización en V1 es de 5 (RNG-09). Por encima, el administrador debe contactar con el equipo de soporte para solicitar ampliación.
* RN-INV.4: El email de invitación contiene el nombre del administrador que invita y el nombre de la organización, para dar contexto al invitado.

## **3.6 FL-05: Recuperación de Clave en Nuevo Dispositivo**

### **3.6.1 Descripción del flujo**

Cuando un usuario autenticado accede a la plataforma desde un dispositivo nuevo (o un navegador sin la clave en IndexedDB), el sistema detecta la ausencia de la clave privada y activa el flujo de recuperación antes de permitir el acceso a cualquier función cifrada.

### **3.6.2 Detección automática y pantalla REC-01**

**Trigger**

Al login exitoso, el cliente comprueba IndexedDB buscando member\_private\_key\_{member\_id}. Si no existe, en lugar de redirigir al dashboard, redirige a /recover-key.

**Pantalla REC-01 — Recuperar acceso cifrado**

| **Elemento** | **Comportamiento** |
| --- | --- |
| Explicación contextual | "Estás en un dispositivo nuevo. Para acceder a tus conversaciones y negociaciones cifradas, necesitas introducir tu Passphrase de Backup." |
| Campo Backup Passphrase | Password input. Rate limiting: máximo 5 intentos antes de bloqueo de 30 minutos (mensajes de cuenta atrás visibles). El bloqueo se aplica SERVER-SIDE en /api/identity/key-recovery. |
| Botón "Recuperar acceso" | Inicia el proceso de recuperación: GET del blob cifrado + descifrado local con Argon2id + AES-GCM. Si GCM authentication tag falla: "Passphrase incorrecta." Sin información sobre el número de intentos restantes hasta el penúltimo intento. |
| Enlace "¿Perdiste tu passphrase?" | Abre modal de información: explica que sin la passphrase el historial cifrado es inaccesible, ofrece la opción de generar un nuevo par de claves (perdiendo el historial cifrado anterior) o buscar el backup en iCloud/Google Drive. |
| Opción "Continuar sin historial cifrado" | Disponible como última opción. Genera un nuevo par de claves. El historial anterior queda inaccesible. Requiere confirmación explícita con checkbox: "Entiendo que mi historial cifrado anterior será inaccesible de forma permanente." |

|  |
| --- |
| **⚠ CONSIDERACIÓN DE SOPORTE**  El equipo de soporte NUNCA puede recuperar la clave privada de un usuario, ni siquiera bajo compulsión legal. Esto es correcto y es la garantía. Los agentes de soporte deben estar instruidos para explicar esto con claridad y sin disculpas: es una característica de privacidad, no un fallo del sistema. |

## **3.7 FL-06: Cambio de Backup Passphrase**

### **3.7.1 Descripción del flujo**

El usuario puede cambiar su backup passphrase en cualquier momento desde Ajustes → Seguridad. El proceso re-cifra la clave privada con una nueva wrapping key derivada de la nueva passphrase.

### **3.7.2 Pantalla SET-SEC-01 — Cambio de Backup Passphrase**

**Pasos del flujo**

1. Autenticación del cambio: el usuario introduce su passphrase ACTUAL. El sistema intenta descifrar el blob actual. Si falla: "Passphrase actual incorrecta." Rate limiting: 5 intentos, luego 30 minutos de bloqueo.
2. Introducción de nueva passphrase: mismos criterios de fortaleza que REG-06 (zxcvbn ≥ 3, mínimo 12 caracteres, diferente a contraseña de login y a la passphrase actual).
3. Re-cifrado local: el browser genera nuevos salt e IV. Deriva nueva wrapping key con Argon2id. Cifra la clave privada con AES-256-GCM.
4. Actualización en servidor: PUT /api/identity/key-backup con el nuevo { encrypted\_key\_blob, key\_iv, argon2\_salt, kdf\_params }. El servidor SOBRESCRIBE el blob anterior. No existe histórico de backups anteriores.
5. Confirmación: mensaje de éxito. La sesión continúa normalmente.

|  |
| --- |
| **💡 NOTA DE SEGURIDAD**  El cambio de passphrase no invalida las sesiones activas del usuario en otros dispositivos. Sin embargo, esos dispositivos seguirán usando la clave privada ya cargada en su IndexedDB local. Si el usuario sospecha que su passphrase ha sido comprometida, debe además cambiar su contraseña de login y revisar sus sesiones activas. |

# **4. Diagrama de Estados del Proceso de Registro**

A continuación se describe la máquina de estados del objeto Member durante el proceso de onboarding:

| **Estado** | **Quién lo asigna** | **Descripción** | **Transiciones posibles** |
| --- | --- | --- | --- |
| **PENDING\_REVIEW** | Sistema automático | Solo Ruta 00.2. El solicitante ha enviado el FSR. El operador aún no ha revisado la solicitud. | INVITED\_APPROVED (aprobación manual del operador) / REJECTED (rechazo manual del operador) / CANCELLED (tras 30 días sin revisión) |
| **INVITED\_APPROVED** | Sistema (Ruta 00.1) o Operador (Ruta 00.2) | El usuario está autorizado a registrarse. Ruta 00.1: estado asignado automáticamente al validar el token de invitación. Ruta 00.2: estado asignado manualmente por el operador tras revisar el FSR. El usuario recibe un enlace al FRO (REG-01). | REGISTERED (tras completar el FRO) |
| **REJECTED** | Operador de Plataforma (manual) | Solo Ruta 00.2. El operador ha denegado el alta tras revisar el FSR. El solicitante recibe EML-08 con el motivo. | Estado terminal. El operador puede revertir excepcionalmente a PENDING\_REVIEW para re-revisión. |
| **REGISTERED** | Sistema automático | El usuario ha completado el FRO. Organización y usuario administrador creados en base de datos. El usuario procede a Fase B (generación de claves E2EE). | KEY\_ACTIVE (tras completar FL-03) |
| **KEY\_ACTIVE** | Sistema automático | Claves E2EE generadas y backup almacenado. Acceso completo a la plataforma. | ACTIVE (tras completar Fase D) / SUSPENDED (acción del operador) |
| **ACTIVE** | Sistema automático | Onboarding completo. El miembro tiene acceso pleno a todas las funcionalidades. | SUSPENDED (acción del operador) |
| **SUSPENDED** | Operador de Plataforma (manual) | Cuenta suspendida (impago, violación de términos). El usuario no puede acceder. | ACTIVE (reactivación por operador) |
| **CANCELLED** | Sistema (timeout) o Operador | Cuenta cancelada. Los datos cifrados se conservan 90 días antes de purga definitiva. | Estado terminal. |

# **5. Reglas de Negocio Globales del Módulo**

| **ID** | **Regla** | **Prioridad** |
| --- | --- | --- |
| RNG-01 | La clave privada X25519 nunca se transmite al servidor en ningún formato, ni siquiera cifrada para propósitos de soporte o depuración. | **CRÍTICA** |
| RNG-02 | La backup passphrase nunca se transmite al servidor, ni en texto plano ni hasheada. | **CRÍTICA** |
| RNG-03 | Todos los endpoints del módulo de onboarding están protegidos por rate limiting. Los parámetros exactos se definen en la especificación técnica, pero ningún endpoint de autenticación acepta más de 10 peticiones por minuto por IP. | **ALTA** |
| RNG-04 | El proceso completo de generación de claves (pasos 1-3 de REG-07) ocurre en un Web Worker. Ninguna operación criptográfica bloquea el hilo principal. | **ALTA** |
| RNG-05 | Los cuatro campos de backup de clave (encrypted\_key\_blob, key\_iv, argon2\_salt, kdf\_params) deben existir en la tabla users desde la primera migración de base de datos. Añadirlos posteriormente requiere un proceso de re-onboarding forzado para todos los usuarios existentes. | **ALTA** |
| RNG-06 | Todos los formularios del módulo deben funcionar correctamente con gestores de contraseñas (1Password, Bitwarden, etc.). Los campos de passphrase deben tener autocomplete="new-password" para la creación y autocomplete="current-password" para la introducción. | MEDIA |
| RNG-07 | La plataforma debe ser completamente funcional en los navegadores: Chrome 120+, Firefox 120+, Safari 17+, Edge 120+. Las operaciones WebCrypto y la API de IndexedDB deben verificarse en todos los targets antes de lanzamiento. | MEDIA |
| RNG-08 | El onboarding debe ser completable en mobile (iOS Safari, Chrome Android). El diseño de las pantallas REG-05, REG-06 y REG-07 debe optimizarse para viewport reducido. | MEDIA |
| RNG-09 | El límite de usuarios por organización en V1 es de 5 (cinco). El Administrador de Organización no puede enviar una sexta invitación hasta que una de las existentes sea rechazada, expire o el usuario sea revocado. Por encima de 5, el admin debe contactar con soporte@bearingworld.io para solicitar ampliación. | **ALTA** |
| RNG-10 | La revocación de un usuario de una organización (acción del Administrador de Organización) NO elimina su clave privada ni su historial cifrado. El usuario pierde el acceso a la plataforma pero su par de claves permanece válido. Si el usuario es re-invitado posteriormente, recupera acceso a su historial previo con la misma passphrase de backup. | **ALTA** |
| RNG-11 | El panel de administración del Operador de Plataforma (ADMIN-01) es accesible exclusivamente desde IPs de la lista blanca corporativa de Bearingworld.io. No es accesible desde internet público. Cualquier intento de acceso desde IP no autorizada devuelve 404 (no 403). | **CRÍTICA** |

# **6. Emails Transaccionales del Módulo**

| **ID Email** | **Trigger** | **Asunto** | **Contenido mínimo** | **CTA** |
| --- | --- | --- | --- | --- |
| EML-01 | Registro exitoso (POST /api/auth/register OK) | Verifica tu email para activar tu cuenta | Nombre del usuario, nombre de empresa, enlace de verificación (expira en 24h), advertencia de expiración. | Botón "Verificar email" |
| EML-02 | Reenvío de verificación solicitado | Nuevo enlace de verificación | Igual que EML-01 con nuevo token. Menciona que el enlace anterior ya no es válido. | Botón "Verificar email" |
| EML-03 | Cambio de email pendiente de verificación | Verifica tu nuevo email | Confirma el nuevo email introducido. Token de verificación vinculado al nuevo email. | Botón "Verificar nuevo email" |
| EML-04 | Invitación a unirse a organización | [Nombre admin] te invita a unirte a [Nombre empresa] en Bearingworld.io | Nombre del admin que invita, nombre de la empresa, descripción breve de la plataforma, enlace de invitación (expira en 7 días). | Botón "Aceptar invitación" |
| EML-05 | Recordatorio de backup no configurado (Day 3 post-registro) | Tu historial cifrado no está protegido aún | Explica que el backup de clave no ha sido configurado. Enlace directo a /settings/security. | Botón "Configurar backup ahora" |
| EML-06 | Confirmación de cambio de backup passphrase | Tu passphrase de backup ha sido actualizada | Confirma el cambio. Fecha y hora. Instrucción: "Si no fuiste tú, contacta soporte inmediatamente." | — |

# **7. Criterios de Aceptación por Flujo**

## **FL-00 — Aprobación por operador**

* CA-00.1: Un operador puede revisar, aprobar o rechazar una solicitud desde el panel ADMIN-01 en menos de 2 minutos.
* CA-00.2: Al aprobar, el usuario recibe EML-07 en menos de 60 segundos y la pantalla REG-04B redirige automáticamente a REG-05 en el próximo ciclo de polling.
* CA-00.3: Al rechazar, el usuario recibe EML-08 con el motivo en menos de 60 segundos.
* CA-00.4: Las solicitudes con más de 48h en cola aparecen con indicador visual ámbar en ADMIN-01 y generan EML-OP-02 automático.
* CA-00.5: Ninguna cuenta puede pasar a APPROVED sin acción manual del operador. Verificable en los logs: no existe ningún registro de transición APPROVED sin operator\_id.
* CA-00.6: El panel ADMIN-01 devuelve 404 desde IPs no incluidas en la whitelist corporativa.

## **FL-01 — Registro**

* CA-01.1: Un usuario puede completar el registro en menos de 10 minutos en condiciones normales.
* CA-01.2: El email de verificación se recibe en menos de 60 segundos tras el registro.
* CA-01.3: Un email duplicado es detectado antes del submit (validación en tiempo real, no solo en el POST).
* CA-01.4: Un usuario con contraseña de fortaleza < Aceptable no puede avanzar al paso siguiente.
* CA-01.5: El registro falla con mensaje claro si el servidor no está disponible. El formulario no se reinicia.
* CA-01.6: Un usuario que se registra con Google SSO completa el flujo completo (incluida la generación de claves E2EE y backup passphrase) sin necesidad de establecer una contraseña en la plataforma.
* CA-01.7: El intento de registrar con Google SSO un email ya existente (registro clásico) ofrece la opción de vincular, sin crear cuenta duplicada.

## **FL-03 — Generación de claves**

* CA-03.1: La clave privada generada NUNCA aparece en las peticiones de red (verificable con DevTools Network tab durante las pruebas de QA).
* CA-03.2: La backup passphrase NUNCA aparece en las peticiones de red ni en los logs del servidor.
* CA-03.3: La UI no se congela durante la derivación Argon2id (el spinner sigue animándose).
* CA-03.4: Si el POST de backup falla, el sistema reintenta sin pedir al usuario que repita la passphrase.
* CA-03.5: Una passphrase débil (zxcvbn < 3) bloquea el avance con mensaje descriptivo.
* CA-03.6: La passphrase idéntica a la contraseña de login bloquea el avance con mensaje específico.

## **FL-05 — Recuperación de clave**

* CA-05.1: Un usuario que ha completado el backup puede recuperar su clave en un navegador nuevo introduciendo únicamente su passphrase.
* CA-05.2: Tras 5 intentos fallidos, el endpoint /api/identity/key-recovery devuelve 429 y el formulario muestra la cuenta atrás de 30 minutos.
* CA-05.3: Un intento de fuerza bruta con un script automatizado desde el exterior es imposible: el endpoint retorna 429 con backoff antes de que sea viable.
* CA-05.4: Un passphrase correcto restaura el historial cifrado previamente accesible.

# **8. Capa Conversacional — VERA en el Módulo de Onboarding**

De acuerdo con el Módulo 00 (Arquitectura de Interacción IA v1.1), la plataforma tiene al agente VERA como interfaz primaria. Esta sección especifica cómo se integra VERA en cada fase del onboarding, tanto como guía activa como canal alternativo para completar acciones.

|  |
| --- |
| **ℹ️ REFERENCIA**  Este apartado implementa las directrices del Módulo 00 sección 8.1 (Cambios en Módulo 01 — Onboarding). Toda decisión sobre tono, límites y comportamiento del agente se rige por el Módulo 00. |

## **8.1 Presencia de VERA durante el onboarding**

A diferencia del resto de la plataforma, donde el panel de VERA ocupa el 30-40% derecho de la pantalla, durante el onboarding la distribución de espacio es diferente: el wizard de registro ocupa el centro y VERA aparece como un panel lateral compacto, siempre visible, que guía proactivamente sin bloquear los formularios.

| **Fase del onboarding** | **Comportamiento de VERA** |
| --- | --- |
| Fase A — FRO: datos de organización y administrador (REG-01) | VERA saluda al nuevo usuario con un mensaje de bienvenida breve y contextual: "Hola, soy VERA. Voy a ayudarte a crear tu cuenta en Bearingworld.io. Son unos minutos y te guío en cada paso." VERA permanece en silencio mientras el usuario rellena el formulario unificado (organización + administrador). Si el usuario lleva más de 3 minutos sin avanzar en un campo, VERA pregunta: "¿Tienes alguna duda con este paso?" VERA responde a preguntas sobre los campos del formulario: qué es el campo sitio web, por qué se pide dirección y código postal, qué requisitos tiene la contraseña. |
| Fase B — Generación de claves E2EE y backup passphrase (REG-05, REG-06, REG-07) | Esta es la fase donde VERA tiene el rol más crítico. El concepto de claves criptográficas es técnicamente complejo para el usuario tipo. VERA lo introduce en REG-05 con lenguaje de negocio, no técnico. VERA responde a las preguntas más frecuentes de esta fase (ver tabla 8.2). Si el usuario intenta cerrar la ventana antes de completar la fase, VERA advierte: "Espera — si cierras ahora sin guardar tu passphrase de backup, perderás acceso a tu historial cifrado si cambias de dispositivo." Durante el procesamiento en REG-07, VERA muestra mensajes de progreso en el panel: "Generando tus claves... esto tarda unos segundos y solo ocurre una vez." |
| Fase C — Bienvenida, usuarios adicionales y acceso al dashboard (REG-09) | VERA acompaña la pregunta de si desea registrar más usuarios ahora, y sugiere el siguiente paso más relevante según el perfil del usuario: si indicó países de operación en Europa durante el FRO, sugiere buscar stock en esas regiones como primer paso tras llegar al dashboard. |

## **8.2 Preguntas frecuentes de VERA durante el onboarding**

Estas son las respuestas que VERA debe dar de forma consistente a las preguntas más comunes durante el proceso de registro. Son la referencia para el prompt del agente en este contexto.

| **Pregunta del usuario** | **Respuesta de VERA** |
| --- | --- |
| "¿Qué es la passphrase de backup?" | "Es como la llave de una caja fuerte. Tus negociaciones y precios viajan cifrados — ni nosotros ni nadie puede leerlos. Esa passphrase es lo único que puede abrir tu historial si cambias de dispositivo. Si la pierdes, nadie puede recuperarlo por ti — ni el soporte técnico. Por eso te pedimos que la guardes en un sitio seguro, separado de tu contraseña." |
| "¿Por qué tengo que crear una passphrase además de mi contraseña?" | "Son dos cosas distintas. La contraseña te da acceso a la plataforma. La passphrase protege el contenido cifrado de tus negociaciones. Si alguien roba tu contraseña, no puede leer tus negociaciones porque no tiene la passphrase. Es una capa extra de protección para tus datos comerciales." |
| "¿Puedo saltarme la generación de claves?" | "No es posible saltarlo — es el fundamento de la privacidad de la plataforma. Pero es un proceso de 2 minutos y solo tienes que hacerlo una vez. ¿Quieres que te explique qué va a pasar paso a paso antes de empezar?" |
| "¿Qué pasa si olvido mi passphrase?" | "Si olvidas la passphrase y no tienes un backup en tu nube personal (iCloud o Google Drive), tu historial cifrado anterior será inaccesible de forma permanente. Por eso insistimos en que la anotes. Tu acceso a la plataforma en sí — búsquedas, inventario, mensajes nuevos — no se ve afectado. Solo perderías el historial ya cifrado." |
| "¿Es seguro guardar mis datos aquí?" | "El servidor nunca puede leer tus precios ni tus negociaciones — es matemáticamente imposible, no una promesa. Funciona igual que WhatsApp: la plataforma transporta los mensajes cifrados, pero no puede abrirlos. Lo único que guardamos es un blob cifrado de tu clave de respaldo, que tampoco podemos descifrar sin tu passphrase." |
| "¿Puedo completar esto más tarde?" | "Las fases A y B (registro y verificación de email) puedes hacerlas y volver en otro momento. La fase C (generación de claves) debes completarla antes de poder usar la plataforma — es el requisito mínimo para garantizar la privacidad de todos los miembros." |

## **8.3 Flujo de onboarding 100% conversacional (alternativa a formularios)**

Como se especifica en el Módulo 00, el usuario puede completar el onboarding respondiendo directamente a VERA en el chat, sin interactuar con los formularios de la UI. VERA rellena los campos por él. Este flujo es una alternativa, no el flujo por defecto.

| **Turno** | **VERA** | **Usuario (ejemplo)** | **Acción del sistema** |
| --- | --- | --- | --- |
| 1 | "Para crear tu cuenta necesito algunos datos de tu empresa. ¿Cómo se llama tu empresa?" | "Rodamientos Martínez S.L." | VERA almacena company\_name en el estado del formulario. |
| 2 | "¿En qué país está la sede?" | "España" | VERA mapea a ISO 3166-1: ES. |
| 3 | "¿Y tu nombre completo?" | "Carlos Martínez" | VERA almacena admin\_name. |
| 4 | "¿Cuál es tu email de trabajo?" | "carlos@rodamientosmartinez.es" | VERA verifica unicidad en tiempo real. Si ya existe, avisa. |
| 5 | "Necesitas una contraseña segura (mínimo 10 caracteres, con mayúsculas, números y algún símbolo). Escríbela aquí — el chat es seguro." | "Rodamien2026!!" | VERA evalúa fortaleza con zxcvbn. Si es < Aceptable, pide una más fuerte con explicación. |
| 6 | "Perfecto. Confirma que aceptas los Términos y Condiciones escribiendo 'acepto'." | "acepto" | VERA marca el checkbox de T&C y ejecuta POST /api/auth/register. |
| 7 | "¡Listo! Tu cuenta está creada. Ahora vamos con el paso más importante: configurar tus claves de privacidad." | — | POST /api/auth/register ejecutado con éxito. VERA pasa directamente a la Fase B (claves E2EE, REG-05) sin ningún paso de verificación de email intermedio. |

|  |
| --- |
| **⚠ SEGURIDAD DEL FLUJO CONVERSACIONAL**  Cuando VERA recoge la contraseña o la passphrase a través del chat, el campo de entrada del chat debe comportarse como un campo de tipo password: los caracteres se enmascaran en tiempo real y el valor no queda en el historial visible de la conversación. El mensaje del usuario se reemplaza por "••••••••••" en el historial de sesión inmediatamente tras el envío. Esta es una excepción al comportamiento estándar del historial de sesión. |

## **8.4 VERA en los flujos de recuperación y gestión de claves (FL-05, FL-06)**

| **Flujo** | **Rol de VERA** |
| --- | --- |
| FL-05 — Recuperación de clave en nuevo dispositivo | Cuando el sistema detecta la ausencia de clave privada en IndexedDB, VERA aparece proactivamente en el panel: "Parece que estás en un dispositivo nuevo. Para acceder a tus conversaciones cifradas necesitas introducir tu Passphrase de Backup. ¿La tienes a mano?" VERA guía el proceso paso a paso y responde dudas. Si el usuario no recuerda la passphrase, VERA explica las opciones con honestidad (incluida la pérdida permanente del historial) sin dramatismo. |
| FL-06 — Cambio de backup passphrase | El usuario puede iniciar este flujo por chat: "Quiero cambiar mi passphrase de backup." VERA guía los 5 pasos del flujo (ver sección 3.7) con confirmaciones intermedias. Tras el éxito, VERA confirma: "Passphrase actualizada. Tu historial cifrado ahora está protegido con la nueva passphrase. Recuerda actualizarla también en tu gestor de contraseñas si lo usas." |
| FL-04 — Invitación de usuario adicional | El administrador puede invitar usuarios por chat: "Invita a pedro@empresa.com." VERA confirma: "Voy a enviar una invitación a pedro@empresa.com. ¿Confirmas?" [botón: Sí, invitar] [botón: Cancelar]. Tras ejecutar, VERA informa: "Invitación enviada. Pedro tiene 7 días para aceptarla." |

# **9. Preguntas Abiertas y Decisiones Pendientes**

| **ID** | **Pregunta** | **Propietario** | **Fecha límite** |
| --- | --- | --- | --- |
| QA-01 | ¿Activamos validación manual de nuevas organizaciones por el operador antes de KEY\_ACTIVE, o el proceso es 100% automático en V1? | Product Owner | Sprint 0 |
| QA-02 | ¿Ofrecemos inicio de sesión con Google/Microsoft SSO en V1 o solo email+contraseña? (Impacta en la gestión de claves E2EE, que requiere passphrase adicional independientemente del método de login.) | CTO + Product Owner | Sprint 0 |
| QA-03 | ¿Cuántos usuarios máximos por organización en V1? Se ha propuesto 10 como límite provisional. | Product Owner | Sprint 1 |
| QA-04 | ¿El backup de clave opcional en iCloud/Google Drive (Opción B del ADR-001) se implementa en V1 o se difiere a V2? | CTO | Sprint 1 |
| QA-05 | ¿Cómo gestionamos la revocación de un usuario de una organización? ¿Su clave privada (y por tanto acceso a su historial) se mantiene o se elimina? (Impacta en diseño de FL-04) | CTO + Legal | Sprint 2 |
| QA-06 | ¿El nombre del producto final está decidido? Los textos de las pantallas usan "Bearingworld.io" como placeholder. | Product Owner | Sprint 0 |

# **10. Historial de Versiones**

| **Versión** | **Fecha** | **Autor** | **Descripción** |
| --- | --- | --- | --- |
| 1.0 | Junio 2026 | Equipo de Producto | Versión inicial. Cubre FL-01 a FL-06. Basado en PRD v1.0 y ADR-001. |
| 1.1 | Junio 2026 | Equipo de Producto | Revisión según Módulo 00 v1.1. Añadida sección 8 completa de capa conversacional VERA. |
| 1.2 | Junio 2026 | Equipo de Producto | Resolución de todas las preguntas abiertas del módulo: (QA-01) aprobación manual obligatoria por operador — nuevo FL-00 y pantalla ADMIN-01; (QA-02) Google SSO en V1 con passphrase E2EE independiente; (QA-03) límite 5 usuarios/organización; (QA-04) backup iCloud/Drive diferido a V2; (QA-05) clave privada se mantiene al revocar usuario; (QA-06) nombre definitivo Bearingworld.io. Máquina de estados ampliada con estados APPROVED y REJECTED. Nuevos emails EML-07, EML-08, EML-OP-01 y EML-OP-02. Nuevas reglas RNG-09, RNG-10, RNG-11. |
| 1.3 | Junio 2026 | Equipo de Producto | Soporte al Directorio de Organizaciones (Módulo 04 v1.2): campos obligatorios de email de contacto público y teléfono de contacto público añadidos al registro. Nueva regla RN-01.7. |
| 1.4 | Junio 2026 | Equipo de Producto | Reestructuración completa del flujo de registro (FL-01) según el diseño simplificado acordado: (1) Dos rutas de entrada: Ruta 00.1 (invitado conocido, aprobación automática) y Ruta 00.2 (desconocido con FSR, aprobación manual por operador). (2) Eliminación de la verificación de email como paso intermedio — simplificación deliberada para reducir fricción. (3) FRO unificado (REG-01 rediseñado) que consolida los datos de organización y del usuario administrador en una única pantalla con dos secciones, incluyendo los nuevos campos obligatorios de dirección y código postal. (4) Eliminación de REG-02 (confirmación), REG-03 (espera de verificación) y REG-04 (destino de enlace de verificación). (5) REG-08 eliminada como pantalla separada — sus campos se incorporan al FRO. (6) REG-09 ampliada con el flujo iterativo de registro de usuarios adicionales ("¿Deseas registrar más usuarios?") hasta el límite de 5 por organización. (7) Máquina de estados simplificada: eliminados PENDING\_VERIFICATION y EMAIL\_VERIFIED, añadidos PENDING\_REVIEW, INVITED\_APPROVED y REGISTERED. (8) Dirección y código postal añadidos como campos obligatorios del perfil de organización, visibles en el FRO, en la ficha pública (MSG-04) y en el Directorio de Organizaciones (MSG-05) del Módulo 04. |
| 1.5 | Junio 2026 | Equipo de Producto | Cierre de comentarios de revisión del Inventario de Pantallas: (1) Corregido un residuo del patch anterior — REG-00-WAIT seguía mostrando un mensaje de verificación de email ya eliminada del flujo; corregido y añadida nota explícita de que es una pantalla de un solo uso, sin acceso posterior una vez resuelta la solicitud. (2) Añadido NIF/CIF como campo obligatorio del FRO (REG-01), reordenados los campos de la Sección 1 según un criterio de relleno lógico (nombre → NIF/CIF → dirección → código postal → país → contacto público → web → operación → marcas → logo → visibilidad). (3) Nueva regla RN-01.8: el rol no es editable en ningún formulario — el primer usuario es Administrador automáticamente, todos los adicionales son Editor. Corregidas las referencias residuales a un selector de rol en INVT-01 y en el ejemplo conversacional FL-04. (4) El FRU se documenta ahora como pantalla propia (sección 3.4.2), separada del FRO, sin ningún campo de organización. (5) Renombrada la pantalla de invitaciones de INV-01 a INVT-01 para evitar conflicto de código con el panel de inventario del Módulo 02. (6) Nueva regla RN-01.9 sobre el NIF/CIF. |

|  |
| --- |
| **📄 DOCUMENTOS DE REFERENCIA**  PRD v1.0 | Tech Stack & AI Cost Estimation v1.0 | ADR-001 — E2EE Key Backup | Módulo 00 — Arquitectura de Interacción IA v1.1 |