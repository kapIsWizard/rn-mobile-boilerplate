# Pattern selection

## Decision sequence

1. Can the field be omitted, tokenized, shortened, or deleted sooner? Do that first.
2. Must the service hide plaintext only from lost media/backups? Use P0 plus authorization and redaction.
3. Is the value a small device credential or wrapping key? Use P1 and define reinstall/biometric behavior.
4. Must database dumps/operators lack plaintext while a trusted backend may decrypt? Use P2 envelope encryption.
5. Must the service/backend never see plaintext? Use P3 and resolve recovery, multi-device, sharing, search, notifications, export, and support before H1.
6. Do fields have different needs? Use P4 and document every intentional plaintext metadata field.

## Required invariants

- P0 is not field encryption or E2EE.
- P1 SecureStore/Keychain/Keystore is for small secrets or key wrappers, not bulk documents.
- P2 uses AEAD, unique nonce per key, authenticated context, DEK/KEK separation, KMS/HSM, and a versioned envelope.
- P3 encrypts before upload and proves that no service-side actor can obtain the decryption material.
- Passwords are hashed by a vetted Auth/KDF system, never reversibly encrypted.
- Authorization/RLS remains mandatory for ciphertext and metadata.
- Raw key material never enters agent context or evidence.

## Contract questions

- Which fields are `confidential`, `restricted`, or `credential`?
- Where and for how long can plaintext exist?
- Who must not be able to read it, and who still can?
- Does the user expect recovery after password reset, reinstall, device loss, or biometric change?
- Are search, push previews, analytics, moderation, sharing, or deduplication required?
- Which metadata leakage is acceptable?
- What rotates, who initiates it, how is interruption resumed, and how is rollback bounded?
- What proves absence of plaintext from device, network-adjacent telemetry, backend storage, logs, and backups?
