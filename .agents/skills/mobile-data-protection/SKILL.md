---
name: mobile-data-protection
description: Design an auditable data-protection contract for Expo or React Native data, local secrets, field encryption, envelope encryption, end-to-end encryption, key storage, rotation, recovery, encrypted backups, searchable encrypted fields, or cryptographic migrations. Use whenever a change handles confidential, restricted, or credential data, introduces cryptography or secure storage, changes plaintext locations, or needs security evidence. Do not handle raw production key material.
---

# Mobile Data Protection Architect

Choose protection from the threat model and data flow. Do not implement product code, operate production keys, approve H1, or judge your own implementation as verified.

## Establish the protection boundary

1. Read the active run, risk policy, specification pack, data model, native storage, backend path, backup behavior, and current official documentation record.
2. Inventory every sensitive field and every possible plaintext location: UI memory, storage, files, network, backend, database, logs, crash/analytics, clipboard, keyboard, screenshots, backups, exports, and evidence.
3. Name the adversaries, trusted plaintext processors, residual privileged readers, loss/recovery behavior, legal constraints, offline requirements, and multi-device behavior.
4. Separate confidentiality, integrity, authentication, authorization, minimization, retention, and redaction. Never claim that encryption replaces RLS or that provider at-rest encryption is E2EE.

Read [pattern-selection.md](references/pattern-selection.md). For detailed platform and lifecycle rules, read [`docs/guidebook/data-encryption-patterns.md`](../../../docs/guidebook/data-encryption-patterns.md). Use `mobile-docs-research` for every version-sensitive API or library decision.

## Produce the contract

- Select P0–P4 per field and flow, not per screen.
- Prefer no stored data, platform facilities, and provider-managed primitives before application cryptography.
- For application encryption, require a reviewed AEAD implementation, versioned envelope, nonce strategy, AAD, separate DEK/KEK boundaries, migration, rotation, revocation, recovery, deletion, and rollback.
- Treat client-side/E2EE as a product architecture with multi-device, sharing, recovery, search, notification, support, and lost-device consequences.
- Record only key metadata. Never request or retain raw keys, recovery phrases, plaintext DEKs, service credentials, signing material, or production ciphertext/plaintext pairs.
- Write `data-protection-contract.json` against `.agentic/schemas/data-protection-contract.schema.json` and place it inside the specification pack so H1 binds its digest.
- Mark an unresolved contract `blocked`; mark a complete proposal `proposed`. There is no agent-authored `approved` status.

## Define proof and stop conditions

Require tamper/wrong-key/wrong-AAD tests, nonce uniqueness, rotation and interrupted-migration tests, plaintext sink scans, backup/reinstall/biometric behavior, backend ciphertext oracle, cross-user denial, and both native platforms where relevant. Require a manual recovery drill for critical profiles.

Stop and return to H1 when the desired adversary, plaintext processor, recovery promise, searchable metadata leakage, provider/KMS, crypto library, regulated-data treatment, or export-compliance answer changes product behavior. Block immediately on homemade crypto, hardcoded keys, raw key exposure, nonce reuse, unauthenticated encryption, or a key and ciphertext sharing the same effective trust boundary without an accepted rationale.

## Hand off

Return the contract path, risk level, selected and rejected patterns, trusted plaintext processors, residual risks, implementation constraints, required evidence, environment/key metadata needs, and exact H1 decision. Builder, verifier, reviewer, release operator, and human remain separate roles.
