## MODIFIED Requirements

### Requirement: key-wrapping
El sistema SHALL derivar una wrapping key de 256 bits a partir de la backup
passphrase usando Argon2id con parámetros `{m:65536, t:3, p:4}` y un salt
aleatorio de 32 bytes, y SHALL cifrar la clave privada X25519 con AES-256-GCM
usando un IV aleatorio de 12 bytes y el `member_id` como AAD. De la misma salida
de Argon2id el sistema SHALL derivar una prueba de la passphrase de 32 bytes con
HKDF-SHA-256 (salt vacío, info `bearingworld.io/key-backup/proof/v1`) y SHALL
enviar al servidor solo su SHA-256 como `key_verifier`. El servidor no almacena
nunca la prueba.
[Origen: ADR-001, secciones 6.1, 6.2 y 11; F-242; DECISIONES-V1, 7-oct-2026]

#### Scenario: cifrado de backup correcto
- GIVEN una backup passphrase válida y una clave privada X25519 recién generada
- WHEN el sistema ejecuta el proceso de cifrado
- THEN se produce un ciphertext AES-256-GCM de 48 bytes
- AND el payload enviado al servidor contiene únicamente
  `{encrypted_key_blob, key_iv, argon2_salt, kdf_params, key_verifier, public_key}`
- AND `public_key` es la clave pública del par recién generado, que la llamada
  registra; al rotar la frase, `replace_key_backup` exige que coincida con la ya
  registrada
- AND la passphrase, la salida de Argon2id, la wrapping key y la prueba NO están
  incluidas en el payload

---

### Requirement: server-blind-storage
El sistema SHALL almacenar en el servidor, para el backup, exclusivamente
`{encrypted_key_blob, key_iv, argon2_salt, kdf_params, key_verifier}`, sin que el
servidor reciba ni pueda derivar la passphrase, la salida de Argon2id, la wrapping
key ni la clave privada en ningún flujo ni circunstancia. Los únicos valores
derivados de la passphrase que el servidor puede recibir son la prueba y el
verificador definidos en key-wrapping, y nada de lo que el servidor recibe o
almacena SHALL permitir comprobar una passphrase candidata con menos coste que una
derivación Argon2id con los `kdf_params` guardados.
[Origen: ADR-001, secciones 5, 8 y 11; F-242; DECISIONES-V1, 7-oct-2026]

#### Scenario: invariante del servidor ciego
- GIVEN cualquier flujo de la capability (generación, recuperación, rotación)
- WHEN el cliente realiza cualquier llamada a la API de gestión de claves
- THEN ningún payload contiene la passphrase, la salida de Argon2id, la wrapping
  key ni la clave privada, en claro ni codificadas
- AND la prueba solo viaja cuando el servidor tiene que comprobar que el cliente
  conoce la passphrase actual, y el servidor no la almacena
- AND el servidor almacena el blob y el verificador, indistinguibles de bytes
  aleatorios sin la passphrase del miembro
