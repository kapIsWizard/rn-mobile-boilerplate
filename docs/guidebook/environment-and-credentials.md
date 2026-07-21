# Native environment and credential boundary

## Purpose

Prove that a specification can be built and verified before implementation begins, without copying secret values into the repository or agent context. `PREFLIGHTING -> PLANNED` requires a ready, hashed environment manifest.

## Environment separation

| Environment | Data | App identifiers | Distribution | Agent access |
|---|---|---|---|---|
| development | synthetic/development | `.dev` | development client | scoped write |
| E2E | synthetic only, resettable | `.e2e` | simulator/internal | scoped fixture write |
| preview | staging/synthetic | `.preview` when practical | TestFlight/Play Internal | read plus gated deployment |
| production | customer | production IDs | stores | read by default; gated mutation |

Do not turn a development database into production by deleting rows. Provision separate projects, credentials, redirect URLs, signing contexts, analytics projects, and application IDs from the beginning.

## Secret classes

| Class | Examples | May reach app bundle? | Storage |
|---|---|---|---|
| public client configuration | Supabase URL and publishable key, Sentry DSN | yes, by design | environment-specific public config |
| sensitive build secret | Sentry source-map token | no | scoped EAS/CI sensitive variable |
| server-only secret | Supabase secret/service-role key, DB password, OAuth client secret | never | backend/secret manager only |
| signing credential | Android keystore/private key, iOS distribution certificate/profile | never | EAS managed credentials or approved secure store |

`EXPO_PUBLIC_` means bundled and recoverable by an end user; it is never a protection mechanism. The manifest stores only names, classifications, owners, storage locations, readiness status, and non-sensitive fingerprints. It never stores values.

## Required preflight

1. Record Node, package manager, Expo/EAS, Xcode, Java/Android SDK, simulator/emulator, and `agent-device` versions.
2. Confirm the exact iOS bundle ID and Android application ID for the target environment.
3. Confirm a build profile and whether the scenario needs Metro, a development build, an internal build, or a store-distributed release.
4. Confirm isolated backend, migration baseline, two synthetic identities, fixture/reset owner, and production-access denial.
5. Confirm device availability and at least one canary open/snapshot per required platform.
6. Inventory credentials by class and owner without revealing values.
7. For OAuth, record provider, platform, client ID label, redirect/deep-link scheme, bundle/application ID, signing-certificate fingerprint source, and build profile.
8. Record blockers. Status is `ready` only when every `requiredCheck` is ready and blockers are empty.

## Android identity model

- Application ID/package name: stable software identity.
- Keystore: container for private signing key and certificate.
- Signing certificate fingerprint: public identity derived from the certificate, used by services such as OAuth.
- Play App Signing may use a store app-signing key distinct from an upload key.
- Development, EAS internal, and Play-distributed builds may therefore require different fingerprints/client registrations.

Never expose or commit the keystore. A fingerprint can be recorded as non-secret evidence, but it must be labelled with its build/distribution source.

## Operator boundary

Humans retain actions that expose billing, legal agreements, identity verification, 2FA, signing ownership, store submission, or production mutation. The agent should explain the exact action and verify non-sensitive outcomes afterward. It must not ask the human to paste a secret into chat or echo a secret-bearing command.
