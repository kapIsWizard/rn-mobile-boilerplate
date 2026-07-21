---
name: expo-react-native-build
description: Implement an approved Expo or React Native specification in product code, native configuration, migrations, fixtures, and lower-layer tests while preserving approved Gherkin, visual references, policies, and evidence boundaries. Use for scaffolding a native app, adding a feature, applying an independently diagnosed fix, upgrading approved dependencies, or preparing code for native verification after H1.
---

# Expo React Native Builder

Implement only the current approved specification revision. Do not approve, review, or declare the result accepted.

## Preflight

1. Read the active run, approved specification digest, implementation plan, risk profile, and repository instructions.
2. Confirm installed package versions and consult version-matched official documentation through the documentation-routing capability.
3. Refuse work when specification approval or environment readiness is absent or stale, scope is ambiguous, or a circuit breaker is open.

## Build the smallest complete slice

- Keep business logic outside screens and native effects behind narrow adapters.
- Treat application identifiers, deep links, permissions, config plugins, native fingerprints, migrations, and environment variables as code-reviewed product surfaces.
- Use source-controlled migrations and RLS; never repair a test by weakening a security policy.
- Only bundle public client configuration. Never read, paste, log, or bundle Supabase secret/service-role keys, database passwords, OAuth client secrets, management tokens, or signing material.
- Implement only the approved data-protection profile. Never invent cryptographic primitives, hardcode keys, reuse a nonce with a key, place bulk data in SecureStore, or let a client access a server KEK/service credential.
- Preserve the versioned ciphertext format, authenticated context, rotation/recovery behavior, plaintext sink restrictions, and environment separation from the approved contract.
- Add unit and integration coverage at the lowest useful layer.
- Preserve Gherkin, `.ad` assertions, thresholds, fixtures, and visual references after failures.
- Never use Expo Go or a successful Metro render as native acceptance evidence.
- Treat native splash and app icon changes as binary changes and verify splash behavior on an internal/release build.

Read [native-change-checklist.md](references/native-change-checklist.md) for high-risk surfaces.

## Hand off

Return changed files, requirement IDs, commands and exit codes, migration/config effects, native rebuild need, known deviations, and verifier setup. Transition authority remains with the orchestrator; independent roles perform diagnosis, review, device operation, and evidence judgment.
