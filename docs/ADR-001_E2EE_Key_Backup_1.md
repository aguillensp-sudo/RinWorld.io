Architecture Decision Record

**ADR-001 — E2EE Private Key Backup Strategy**

BearingNet Competitor Platform · June 2026 · Confidential

|  |  |
| --- | --- |
| **ADR number** | ADR-001 |
| **Title** | E2EE Private Key Backup Strategy |
| **Status** | ACCEPTED |
| **Date** | June 2026 |
| **Deciders** | CTO, Lead Engineer, Product Owner |
| **Supersedes** | None — first decision on this topic |
| **Related to** | ADR-002 (pending) — E2EE Messaging Protocol Selection |

# **1. Context and Problem Statement**

The BearingNet Competitor Platform is built on a zero-knowledge architecture: all commercial data (prices, negotiations, transaction history) is encrypted end-to-end using the Signal Protocol. Each member holds an X25519 key pair. The private key is generated in the browser, stored in IndexedDB, and is the sole means of decrypting the member's message history and negotiation records.

This creates an irreversible data-loss scenario: if a member loses their private key — by clearing their browser, replacing their device, or forgetting their passphrase — their entire encrypted history becomes permanently inaccessible. Given the target audience (bearing distributors, typically non-technical, often using corporate IT that wipes devices on hardware refresh), this is not a rare edge case. It is a predictable, frequent event that must be solved before launch.

The decision required is: how should the platform enable private key recovery without compromising the mathematical privacy guarantee that is the platform's primary competitive differentiator?

# **2. Decision Drivers**

* Privacy guarantee must not be weakened. The server must never hold a key it can decrypt.
* Recovery must work cross-platform. Target users operate on Windows, macOS, iOS and Android — often mixing ecosystems.
* Recovery UX must be self-serve. A lost key cannot require support intervention; the support team cannot read encrypted data.
* Multi-device access is table stakes. Members use desktop at the office, mobile in the warehouse, laptop at trade shows.
* Implementation must be buildable in Sprint 1. The users table schema must include key backup fields from day one.
* The mechanism must be explainable to a distributor in two sentences. Trust depends on comprehension.

# **3. Considered Options**

## **Option A — No backup (device-local key only)**

The private key lives exclusively in the browser’s IndexedDB. No backup mechanism is provided. Members are warned at registration that loss of the key means permanent loss of history.

Rejected. The target user profile — average age 50+, corporate IT-managed devices, hardware refresh every 3–4 years — guarantees a significant fraction of members will lose their keys within the first year. A platform that permanently destroys a member’s commercial history is not viable in this market regardless of the privacy guarantee it offers.

## **Option B — User-controlled cloud backup (iCloud / Google Drive)**

The member stores an encrypted copy of their private key in their personal cloud storage (iCloud Keychain, Google Drive, or equivalent). The platform never receives the backup file.

Accepted as optional complement only. This works well within a single ecosystem (Apple devices or Google devices) but fails at the moment of greatest pain: when a member switches platforms or uses a corporate device that does not have personal cloud storage configured. It cannot be the primary mechanism. It will be offered as a secondary option for members who prefer it.

## **Option C — Platform-hosted E2EE key backup (chosen)**

The member chooses a backup passphrase at registration (distinct from their login password). The platform derives a 256-bit wrapping key from this passphrase using Argon2id. The private key is encrypted with AES-256-GCM using the wrapping key, and the resulting ciphertext is stored on the platform’s S3/R2. The passphrase never leaves the browser. The server stores an opaque blob it cannot decrypt.

Recovery on any device: the member enters their backup passphrase, the platform downloads the ciphertext, re-derives the wrapping key client-side, decrypts the private key, and restores it to IndexedDB. The member’s full history is immediately accessible.

# **4. Options Comparison**

| **Dimension** | **Option A — No backup** | **Option B — User cloud** | **Option C — Platform E2EE (chosen)** |
| --- | --- | --- | --- |
| Key storage | IndexedDB only. Device-local, nowhere else. | iCloud / Google Drive. Encrypted file, user-owned. | Platform S3/R2. AES-256-GCM ciphertext. Passphrase never transmitted. |
| Privacy guarantee | Perfect. Platform never touches the key. | Strong. Platform never touches it. Apple/Google might. | Strong. Server stores opaque ciphertext. Mathematically cannot read. |
| Recovery UX | Impossible. History gone forever if passphrase lost. | Works within same ecosystem. Fails cross-platform (iOS → Android). | Any device, any browser. Enter backup passphrase, key restored. |
| Multi-device | Manual export/import. UX nightmare for non-technical users. | Works within Apple or Google ecosystem. Breaks across ecosystems. | Seamless. Same passphrase unlocks key on any device. |
| Support burden | Very high. Lost key = permanent dead end for support team. | Medium. Cross-platform failures generate tickets. | Low. Self-serve recovery via passphrase. No support intervention needed. |
| **Verdict** | **Reject — unacceptable UX risk at this user profile.** | **Optional add-on only (complementary to Option C).** | **RECOMMENDED — primary backup mechanism.** |

*Option B (user cloud backup) is not mutually exclusive with Option C. Members who prefer not to store anything on the platform can use Option B as their sole backup method. This is a UX preference, not a security trade-off.*

# **5. Decision**

Option C — Platform-hosted E2EE key backup — is adopted as the primary key backup and recovery mechanism. Option B is offered as a voluntary secondary option during onboarding.

The decision rests on three arguments:

1. The server remains blind. The passphrase is never transmitted. The server stores AES-256-GCM ciphertext with a randomly generated IV and Argon2id salt. Without the passphrase, the ciphertext is computationally indistinguishable from random bytes. A full platform database breach exposes nothing about any member’s private key.
2. It works for every member. No dependency on Apple, Google, or any third-party cloud. A distributor on Windows Chrome who buys a new laptop recovers their key by entering a passphrase — no other steps required.
3. It eliminates the support dead end. With no backup, a lost key is an irreversible support ticket that ends with “we cannot help you.” With Option C, recovery is fully self-serve and the support team never needs to be involved.

# **6. Cryptographic Specification**

## **6.1 Key derivation function**

Argon2id is used to derive the 256-bit wrapping key from the member’s backup passphrase. Argon2id is chosen over bcrypt and scrypt for three reasons:

* Memory-hardness (64 MB) makes GPU-based brute-force attacks 100×–100ð°°× more expensive than bcrypt.
* The ‘id’ variant combines data-independent and data-dependent memory access, providing resistance to both side-channel attacks and time-memory trade-offs.
* NIST recommends Argon2id as the preferred password hashing function (NIST SP 800-132, 2022 draft).

Parameters (subject to revision after cryptographic audit):

| **Field** | **Type / Value** | **Notes** |
| --- | --- | --- |
| **algorithm** | Argon2id | RFC 9106 variant |
| **memory\_cost** | 65536 KB (64 MB) | Minimum viable for browser; adjust up after perf testing |
| **time\_cost** | 3 iterations | CPU time factor |
| **parallelism** | 4 lanes | Match navigator.hardwareConcurrency on typical desktop |
| **output\_length** | 32 bytes (256 bit) | Wrapping key length for AES-256 |
| **salt** | 32 bytes, random | Generated with crypto.getRandomValues(). Stored in DB. |
| **salt\_storage** | users.argon2\_salt | Plaintext — salt is not secret, only the passphrase is |

## **6.2 Encryption of the private key**

The X25519 private key (32 bytes) is encrypted using AES-256-GCM with the wrapping key derived above.

| **Field** | **Type / Value** | **Notes** |
| --- | --- | --- |
| **algorithm** | AES-256-GCM | Authenticated encryption — provides confidentiality + integrity |
| **key\_length** | 256 bit | Derived from Argon2id output |
| **iv\_length** | 12 bytes (96 bit) | Randomly generated per encryption. Stored in DB. |
| **tag\_length** | 16 bytes (128 bit) | GCM authentication tag — detects wrong passphrase or tampering |
| **plaintext** | X25519 private key | 32 bytes. Never leaves the browser in plaintext. |
| **ciphertext** | users.encrypted\_key\_blob | 48 bytes (32 plaintext + 16 GCM tag). Stored in DB. |
| **aad** | member\_id (UUID) | Additional authenticated data — binds ciphertext to identity |

## **6.3 PostgreSQL schema additions (users table)**

These four columns must be present from the first migration. Adding them later requires a forced re-onboarding flow for all existing members.

| **Field** | **Type / Value** | **Notes** |
| --- | --- | --- |
| **encrypted\_key\_blob** | BYTEA, nullable | AES-256-GCM ciphertext of X25519 private key. NULL until member completes backup setup. |
| **key\_iv** | BYTEA(12), nullable | GCM initialisation vector. Generated fresh at each backup update. |
| **argon2\_salt** | BYTEA(32), nullable | Argon2id salt. Random, stored in plaintext. NULL until backup setup. |
| **kdf\_params** | JSONB, nullable | {"algo":"argon2id","m":65536,"t":3,"p":4,"v":19}. Allows future parameter upgrades without breaking existing blobs. |

*Why JSONB for kdf\_params: Argon2id parameters will likely be strengthened as hardware improves. Storing parameters alongside the ciphertext allows the platform to re-derive with the correct parameters when recovering, and to prompt members to re-encrypt with stronger parameters on next login.*

# **7. Recovery Flow (Step by Step)**

## **7.1 Registration (first-time backup setup)**

1. Member completes registration and is prompted to set a backup passphrase. The prompt explains: “This passphrase is the only way to recover your encrypted history on a new device. We never send it to our servers. Write it down somewhere safe.”
2. Browser generates a random 32-byte Argon2id salt using crypto.getRandomValues().
3. Browser runs Argon2id(passphrase, salt, m=65536, t=3, p=4) → 32-byte wrapping key. This takes ~500ms–1s on a modern device — acceptable for a one-time setup step.
4. Browser generates a random 12-byte IV using crypto.getRandomValues().
5. Browser encrypts the X25519 private key with AES-256-GCM(wrapping\_key, iv, aad=member\_id) → 48-byte ciphertext.
6. Browser POSTs { encrypted\_key\_blob, key\_iv, argon2\_salt, kdf\_params } to /api/identity/key-backup. The passphrase and wrapping key are NOT in this payload and are discarded from memory.
7. Server writes the four fields to the users table. Server cannot derive the wrapping key because it never receives the passphrase.

## **7.2 Recovery on a new device**

1. Member logs in with their standard credentials on the new device. IndexedDB is empty — no private key present.
2. Platform detects missing key and redirects to the key-recovery screen.
3. Member enters their backup passphrase. Rate limiting: 5 attempts then 30-minute cooldown (enforced server-side on the /api/identity/key-recovery endpoint). Brute-force is computationally infeasible regardless due to Argon2id’s memory cost.
4. Browser fetches { encrypted\_key\_blob, key\_iv, argon2\_salt, kdf\_params } from the server.
5. Browser re-derives wrapping key: Argon2id(passphrase, stored\_salt, kdf\_params).
6. Browser decrypts: AES-256-GCM-Decrypt(ciphertext, wrapping\_key, key\_iv, aad=member\_id). If the GCM authentication tag fails (wrong passphrase or tampered blob), decryption is aborted and an error is shown.
7. Recovered private key is stored in IndexedDB. Member’s full encrypted history is immediately accessible.

# **8. Three Invariants That Must Hold in Every Implementation**

|  |  |
| --- | --- |
| **Invariant** | Server-blind: the backup passphrase is never transmitted to the server under any circumstances. It must not appear in request payloads, logs, error messages, or analytics events. Any code path that sends the passphrase to the server is a critical security bug. |
| **Invariant** | Separate credentials: the backup passphrase must be a different secret from the login password. If login credentials are compromised (e.g. via a database breach or phishing), the attacker still cannot derive the wrapping key and decrypt the private key. |
| **Invariant** | Rate-limited recovery: the /api/identity/key-recovery endpoint must enforce server-side rate limiting (5 attempts, then cooldown). Client-side rate limiting alone is not sufficient. |

# **9. Consequences**

|  |  |
| --- | --- |
| **Positive** | Members can recover their full encrypted history on any device without contacting support. |
| **Positive** | The privacy guarantee is mathematically preserved. The server cannot decrypt the private key even under legal compulsion, because it does not hold the passphrase. |
| **Positive** | The support team has a clear, honest answer to ‘I lost my key’: enter your backup passphrase. No need to say ‘we cannot help you.’ |
| **Positive** | kdf\_params as JSONB enables future-proof upgrades to stronger Argon2id parameters without breaking existing backups. |
| **Negative** | If a member loses their backup passphrase AND has no Option B (cloud backup), their history is permanently inaccessible. This is the correct behaviour — it is the privacy guarantee — but it must be communicated clearly at onboarding. |
| **Negative** | The Argon2id computation (~500ms) adds latency to the backup setup and recovery flows. This is acceptable for one-time operations but must run off the main thread to avoid blocking the UI. |
| **Neutral** | The four new columns add negligible storage overhead (< 200 bytes per member). |
| **Neutral** | An independent cryptographic audit of this implementation is required before GA launch (flagged in the Tech Stack document as a mandatory pre-launch milestone). |

# **10. Open Questions and Follow-on Decisions**

* ADR-002 (pending): Signal Protocol adapter selection — libsodium.js vs. @privacyresearch/libsignal-protocol-typescript.
* Onboarding UX design (Sprint 2): How prominent should the backup passphrase prompt be? Blocking vs. dismissible. Recommended: blocking on first login, dismissible reminder on subsequent logins until backup is set.
* Passphrase strength policy: enforce minimum entropy (e.g. zxcvbn score ≥ 3) or leave it to the member? Recommendation: enforce — a weak passphrase undermines the Argon2id protection.
* Argon2id parameter review: recommended parameters are based on June 2026 device performance benchmarks. Revisit after 12 months or when hardware landscape changes.
* Key rotation: what happens when a member wants to change their backup passphrase? The private key must be re-encrypted with a new wrapping key and the new blob uploaded. Design this flow in Sprint 3.

ADR-001 · BearingNet Competitor Platform · June 2026 · Confidential