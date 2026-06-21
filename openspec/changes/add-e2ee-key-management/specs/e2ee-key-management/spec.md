# E2EE Key Management Specification

## Purpose
Garantizar que cada miembro de Bearingworld.io posea un par de claves criptográficas
X25519 generado y custodiado exclusivamente en su dispositivo, con un mecanismo de
backup cifrado en plataforma que permita la recuperación autónoma en cualquier
dispositivo sin que el servidor pueda acceder nunca al material de clave privada.

---

## ADDED Requirements

---

### Requirement: key-generation
El sistema SHALL generar el par de claves X25519 del miembro exclusivamente en el
navegador del usuario, usando `crypto.getRandomValues()` vía WebCrypto API, ejecutado
en un Web Worker para no bloquear el hilo principal de la UI.
[Origen: Módulo 01 v1.5, sección 3.3.1 y RNG-04; ADR-001, sección 6]

#### Scenario: generación exitosa en registro
- GIVEN un nuevo miembro que ha completado el FRO y establecido su backup passphrase
- WHEN el sistema ejecuta el proceso de generación de claves
- THEN se genera un par X25519 válido en el navegador
- AND la clave privada nunca sale del dispositivo en texto plano
- AND la clave pública se registra en el servidor vía `POST /api/identity/public-key`

#### Scenario: generación en Web Worker
- GIVEN que el proceso de generación de claves está en curso
- WHEN se ejecutan las operaciones criptográficas
- THEN ninguna operación bloquea el hilo principal de la UI
- AND el usuario ve un indicador de progreso de 4 pasos durante todo el proceso

---

### Requirement: passphrase-policy
El sistema SHALL exigir que la backup passphrase cumpla una fortaleza mínima de
score ≥ 3 según zxcvbn y un mínimo absoluto de 12 caracteres, y SHALL rechazar
cualquier passphrase idéntica a la contraseña de login del usuario.
[Origen: Módulo 01 v1.5, sección 3.3.3 y RN-06.1; ADR-001, sección 10]

#### Scenario: passphrase aceptada
- GIVEN un miembro en la pantalla REG-06 introduciendo su backup passphrase
- WHEN la passphrase tiene score zxcvbn ≥ 3, mínimo 12 caracteres y es distinta
  a la contraseña de login
- THEN el indicador visual muestra "Fuerte" o "Muy fuerte"
- AND el botón "Continuar" queda habilitado al confirmar la coincidencia y marcar
  el checkbox de comprensión

#### Scenario: passphrase idéntica a contraseña de login
- GIVEN un miembro introduciendo una backup passphrase
- WHEN la passphrase es idéntica a su contraseña de login
- THEN el sistema muestra: "La passphrase de backup debe ser diferente a tu
  contraseña de acceso"
- AND el botón "Continuar" permanece deshabilitado

#### Scenario: passphrase demasiado débil
- GIVEN un miembro introduciendo una backup passphrase
- WHEN la passphrase tiene score zxcvbn < 3 o menos de 12 caracteres
- THEN el indicador muestra el nivel correspondiente (Muy débil / Débil / Aceptable)
- AND el botón "Continuar" permanece deshabilitado

---

### Requirement: passphrase-bloqueante
El sistema SHALL hacer obligatorio el establecimiento de la backup passphrase antes
de generar el par de claves, sin ofrecer ninguna opción de omitir o diferir este paso.
[Origen: Módulo 01 v1.5, sección 3.3.3]

#### Scenario: intento de saltar el paso
- GIVEN un miembro en la pantalla REG-06
- WHEN intenta navegar a cualquier otra sección sin completar la passphrase
- THEN el sistema impide la navegación
- AND mantiene al usuario en REG-06 hasta que el paso se complete correctamente

---

### Requirement: key-wrapping
El sistema SHALL derivar una wrapping key de 256 bits a partir de la backup
passphrase usando Argon2id con parámetros `{m:65536, t:3, p:4}` y un salt
aleatorio de 32 bytes, y SHALL cifrar la clave privada X25519 con AES-256-GCM
usando un IV aleatorio de 12 bytes y el `member_id` como AAD.
[Origen: ADR-001, secciones 6.1 y 6.2; Módulo 01 v1.5, sección 3.3.4]

#### Scenario: cifrado de backup correcto
- GIVEN una backup passphrase válida y una clave privada X25519 recién generada
- WHEN el sistema ejecuta el proceso de cifrado
- THEN se produce un ciphertext AES-256-GCM de 48 bytes
- AND el payload enviado al servidor contiene únicamente
  `{encrypted_key_blob, key_iv, argon2_salt, kdf_params}`
- AND la passphrase y la wrapping key NO están incluidas en el payload

---

### Requirement: server-blind-storage
El sistema SHALL almacenar en el servidor exclusivamente el blob cifrado
`{encrypted_key_blob, key_iv, argon2_salt, kdf_params}`, sin que el servidor
reciba ni pueda derivar la passphrase, la wrapping key ni la clave privada
en ningún flujo ni circunstancia.
[Origen: ADR-001, sección 5; Módulo 01 v1.5, RNG-01 y RNG-02]

#### Scenario: invariante del servidor ciego
- GIVEN cualquier flujo de la capability (generación, recuperación, rotación)
- WHEN el cliente realiza cualquier llamada a la API de gestión de claves
- THEN ningún payload contiene la passphrase, la wrapping key ni la clave privada
  en texto plano ni en ninguna forma derivada directamente
- AND el servidor almacena datos computacionalmente indistinguibles de bytes aleatorios
  sin la passphrase del miembro

---

### Requirement: local-storage
El sistema SHALL almacenar la clave privada en IndexedDB del navegador bajo la
clave `member_private_key_{member_id}`, y SHALL eliminar de memoria la passphrase
y la wrapping key inmediatamente tras el almacenamiento exitoso del backup en servidor.
[Origen: Módulo 01 v1.5, RN-07.2]

#### Scenario: almacenamiento local tras backup exitoso
- GIVEN que el `POST /api/identity/key-backup` ha respondido con éxito
- WHEN el sistema finaliza el proceso de generación
- THEN la clave privada queda en IndexedDB bajo `member_private_key_{member_id}`
- AND la passphrase y la wrapping key son eliminadas de memoria del Web Worker

---

### Requirement: backup-upload-retry
El sistema SHALL reintentar automáticamente el `POST /api/identity/key-backup`
hasta 3 veces con backoff exponencial (1s, 2s, 4s) ante fallos de red, manteniendo
la passphrase en memoria del Web Worker hasta el éxito, y SHALL mostrar un error
accionable con botón "Reintentar" si persiste el fallo tras los 3 intentos.
[Origen: Módulo 01 v1.5, RN-07.1]

#### Scenario: fallo de red transitorio
- GIVEN que el `POST /api/identity/key-backup` falla por error de red
- WHEN el sistema ejecuta los reintentos automáticos
- THEN reintenta hasta 3 veces con esperas de 1s, 2s y 4s
- AND la passphrase permanece en memoria del Web Worker durante los reintentos
- AND el usuario NO es redirigido a REG-06

#### Scenario: fallo persistente tras reintentos
- GIVEN que los 3 reintentos han fallado
- WHEN el sistema agota los intentos
- THEN muestra un mensaje de error descriptivo
- AND ofrece un botón "Reintentar" accionable por el usuario

---

### Requirement: key-recovery
El sistema SHALL detectar la ausencia de clave privada en IndexedDB tras un login
exitoso y SHALL activar el flujo de recuperación (REC-01) antes de permitir acceso
a cualquier función cifrada, permitiendo la recuperación mediante backup passphrase
con rate limiting de 5 intentos y bloqueo de 30 minutos aplicado server-side.
[Origen: Módulo 01 v1.5, sección 3.6; ADR-001, sección 7.2]

#### Scenario: recuperación exitosa en nuevo dispositivo
- GIVEN un miembro autenticado cuya IndexedDB no contiene su clave privada
- WHEN introduce su backup passphrase correcta en REC-01
- THEN el sistema descarga el blob cifrado del servidor
- AND re-deriva la wrapping key con Argon2id usando el salt almacenado
- AND descifra la clave privada con AES-256-GCM
- AND almacena la clave recuperada en IndexedDB
- AND el miembro accede a su historial cifrado completo sin intervención de soporte

#### Scenario: passphrase incorrecta en recuperación
- GIVEN un miembro en REC-01 introduciendo su backup passphrase
- WHEN la passphrase es incorrecta y el tag de autenticación GCM falla
- THEN el sistema muestra "Passphrase incorrecta" sin revelar información adicional
- AND el intento se contabiliza contra el límite de 5 server-side

#### Scenario: bloqueo por intentos excesivos
- GIVEN un miembro que ha consumido los 5 intentos permitidos en REC-01
- WHEN intenta un sexto intento
- THEN el endpoint `/api/identity/key-recovery` rechaza la petición server-side
- AND el sistema muestra cuenta atrás del bloqueo de 30 minutos

#### Scenario: generación de nuevo par tras pérdida de passphrase
- GIVEN un miembro que no recuerda su backup passphrase y no tiene backup en nube
- WHEN confirma explícitamente mediante checkbox que entiende la pérdida permanente
  de su historial cifrado anterior
- THEN el sistema genera un nuevo par de claves X25519
- AND el historial cifrado anterior queda permanentemente inaccesible

---

### Requirement: passphrase-rotation
El sistema SHALL permitir al miembro cambiar su backup passphrase desde
Ajustes → Seguridad, re-cifrando la clave privada con una nueva wrapping key
derivada de la nueva passphrase y sobrescribiendo el blob anterior en servidor,
sin conservar histórico de backups previos.
[Origen: Módulo 01 v1.5, sección 3.7; ADR-001, sección 10]

#### Scenario: rotación exitosa
- GIVEN un miembro autenticado en SET-SEC-01 que introduce su passphrase actual correcta
- WHEN introduce y confirma una nueva passphrase válida (misma política que en registro)
- THEN el browser genera nuevos salt e IV aleatorios
- AND deriva la nueva wrapping key con Argon2id
- AND cifra la clave privada con AES-256-GCM
- AND el `PUT /api/identity/key-backup` sobrescribe el blob anterior
- AND la sesión continúa sin interrupción

#### Scenario: passphrase actual incorrecta al intentar rotación
- GIVEN un miembro en SET-SEC-01
- WHEN introduce una passphrase actual incorrecta
- THEN el sistema muestra "Passphrase actual incorrecta"
- AND aplica rate limiting de 5 intentos con bloqueo de 30 minutos server-side

---

### Requirement: schema-desde-dia-uno
El sistema SHALL incluir los cuatro campos de backup
`{encrypted_key_blob, key_iv, argon2_salt, kdf_params}` en la tabla `users`
desde la primera migración de base de datos, admitiendo valores NULL hasta
que el miembro complete el proceso de generación de claves.
[Origen: Módulo 01 v1.5, RNG-05; ADR-001, sección 6.3]

#### Scenario: esquema presente en primera migración
- GIVEN la primera migración de base de datos ejecutada en cualquier entorno
- WHEN se inspecciona el esquema de la tabla `users`
- THEN los campos `encrypted_key_blob`, `key_iv`, `argon2_salt` y `kdf_params`
  existen con sus tipos correctos (BYTEA / JSONB) y son nullable

---

## Out of Scope
- Selección del adaptador Signal Protocol (ADR-002 pendiente — GAP-001).
- Backup opcional en iCloud/Google Drive (Opción B ADR-001 — diferido a V2).
- Cifrado de mensajes y tarjetas de negociación (capability messaging-and-negotiation).
- UI de onboarding que envuelve estos flujos (capability organization-onboarding).
- Revocación de clave al eliminar un usuario de una organización (fuera de V1).
- Auditoría criptográfica independiente (milestone pre-GA, fuera del alcance de specs).

---

## Cross-Capability References
- `organization-onboarding` — invoca esta capability en FL-03 (generación),
  FL-05 (recuperación) y FL-06 (rotación).
- `messaging-and-negotiation` — depende del par de claves X25519 generado aquí
  para el cifrado híbrido de mensajes y tarjetas.

---

## Open Questions
- GAP-001: ADR-002 pendiente — selección de adaptador Signal Protocol.
  No bloqueante para esta capability.
- GAP-002: ¿zxcvbn score ≥ 3 como mínimo obligatorio o recomendado?
  Pendiente de decisión formal de Product Owner + CTO. El spec asume obligatorio
  (coherente con REG-06 del Módulo 01 v1.5) — si la decisión cambia, se modifica
  únicamente el requirement `passphrase-policy`.
- GAP-003: Parámetros Argon2id sujetos a revisión periódica. El campo `kdf_params`
  en JSONB permite actualizar parámetros sin reescribir esta spec ni el esquema.