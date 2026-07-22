# Product north star — native mobile boilerplate

Status: product direction confirmed by the owner; detailed Phase 1 H1 pack still pending
Risk: `critical`
Updated: 2026-07-22

## Product goal

This repository is the reusable starting point for future native Expo/React Native products. A new project should inherit two complete foundations:

1. a production-oriented authentication and account lifecycle for email, phone, Google, and Apple;
2. the evidence-driven agentic delivery flow for specification, implementation, native verification, human acceptance, release, monitoring, and debugging.

The repository is not a demo notes application. A tiny protected profile or domain canary may prove authorization, but domain functionality is replaceable. Authentication, account lifecycle, native infrastructure, and the delivery control plane are the product.

## What “boilerplate includes authentication” means

Authentication is a reusable vertical capability, not four disconnected buttons. It includes:

- registration/onboarding and returning-user login;
- email verification and password recovery;
- phone OTP request, verification, resend, expiry, rate-limit and abuse boundaries;
- Google and Apple provider handoff, cancel, denial, callback, token exchange, and account collision behavior;
- one normalized session contract and route guard independent of the selected entry method;
- cold start, background/foreground refresh, expiration, reauthentication, logout, and local credential removal;
- protected profile data with owner-only RLS as the authorization canary;
- in-app account deletion, associated-data deletion, and provider revocation where required;
- platform-protected session persistence and proof that tokens do not leak into logs, AsyncStorage, screenshots, fixtures, or committed evidence;
- deterministic lower-layer and native E2E tests plus explicitly human-operated real-provider canaries;
- provider configuration, branding, redirect/callback, application identifiers, environments, and required portal actions without committed secrets.

Social and phone methods often create an account on first successful authentication and sign into it later. The UI should use accurate language such as “Kontynuuj z Google/Apple” where registration and login are one provider operation; it must not pretend they are different backend actions.

## Default architecture

- Expo/React Native application in `apps/reference-mobile` using development and release-like native builds; Expo Go is not acceptance evidence.
- Supabase Auth is the default identity backend and reference implementation.
- Product screens and route guards depend on a narrow application-owned auth/session contract, not directly on provider SDK calls.
- Provider adapters remain explicit: email/password, phone OTP, Google, and Apple. This seam is replaceable, but the first implementation is not a speculative multi-backend framework.
- Supabase migrations create the application profile and RLS policies; the service-role key never enters the app.
- Session credentials use the approved P1 platform-protected storage boundary. Public project URLs, publishable keys, client IDs, URL schemes, and bundle IDs are configuration, not secrets.
- Provider secrets, SMS credentials, Apple signing material, service-role keys, and test-account credentials remain in human/provider-controlled secret stores.

## Provider/platform contract

| Method | iOS | Android | Deterministic CI/E2E | Real-provider proof |
|---|---|---|---|---|
| Email + password | required | required | local email inbox + isolated E2E | hosted backend canary |
| Phone OTP | required | required | fixed E2E numbers and test OTP only | one bounded SMS-provider canary |
| Google | required | required | adapter/error contracts; no fake claim of Google success | synthetic Google account on installed builds |
| Apple | native and required | adapter shipped; enabled per project | adapter/error contracts; no fake claim of Apple success | synthetic Apple account; iOS always, Android when enabled |

Apple on iOS uses the platform-correct native capability. The Android Apple adapter is part of the boilerplate but remains capability-gated because it requires an Apple Services ID, redirect endpoint, secret rotation, and product decision. A project enabling a provider without complete configuration fails preflight rather than hiding a broken button.

## Acceptance criteria

| ID | Criterion | Required proof |
|---|---|---|
| `REQ-TPL-001` | A documented bootstrap produces a rebranded native app with unique iOS/Android identifiers, URL scheme, environments, and auth capability configuration without manual source-code surgery. | clean-template self-test + config validation |
| `REQ-TPL-002` | Email registration, verification, login, forgotten-password recovery, and returning-user login work on installed iOS and Android builds. | native replay + email/backend oracle |
| `REQ-TPL-003` | Phone registration/login handles E.164 input, OTP request/verification, resend cooldown, invalid/expired code, rate limit, and recovery on both platforms. | deterministic test OTP replay + backend oracle |
| `REQ-TPL-004` | Google creates or restores the expected Supabase session on installed iOS and Android builds without leaking provider or session tokens. | real-provider canary + backend identity oracle + sink scan |
| `REQ-TPL-005` | Apple creates or restores the expected session natively on iOS; the Android path works when enabled and cannot appear when unconfigured. | real-provider canary + capability/config proof |
| `REQ-TPL-006` | All methods converge on one application session state, authenticated route tree, profile identity, error taxonomy, logout behavior, and lifecycle contract. | unit/integration matrix + native lifecycle replay |
| `REQ-TPL-007` | A cold start, background/foreground cycle, valid refresh, expired/revoked session, and authentication callback resolve deterministically without exposing protected screens early. | clock/session fixtures + installed-build replay |
| `REQ-TPL-008` | Owner-only profile data is enforced by backend RLS; another user cannot read or mutate it and the UI does not substitute for authorization. | RLS integration suite + cross-user oracle |
| `REQ-TPL-009` | Logout removes local session credentials and protected data; account deletion requires recent authentication, deletes associated application data, revokes Apple tokens when applicable, and returns to the unauthenticated state. | storage/backend/provider oracles + native replay |
| `REQ-TPL-010` | Provider cancellation, network loss, duplicate callback, invalid nonce/state, user denial, collision, and backend outage create no partial or duplicate session and expose actionable, non-enumerating errors. | adversarial contract tests + native recovery scenarios |
| `REQ-TPL-011` | Provider and session credentials are absent from source, bundles beyond approved public identifiers, AsyncStorage, logs, telemetry, screenshots, crash reports, and committed evidence. | secret/config audit + unique marker sink scan |
| `REQ-TPL-012` | Auth UI has approved loading, error, verification, provider-disabled and authenticated states; it meets screen-reader, keyboard, autofill, dynamic type, localization, reduced-motion, safe-area, and provider-brand rules. | semantic assertions + visual contract + human accessibility pass |
| `REQ-TPL-013` | Every business-critical deterministic scenario is replayable with `agent-device` on installed iOS and Android builds; real provider boundaries are labeled `requires-human` until a trustworthy canary completes. | `.ad` suite + evidence map + human canary record |
| `REQ-TPL-014` | A freshly generated project can run the same H1/H2/H3, debugging, monitoring, audit, native CI/CD, and release preparation flows without inheriting prior project data or approvals. | template self-test + isolated run evidence |

Executable business scenarios begin in [`phase-1-auth-foundation/authentication.feature`](../requirements/phase-1-auth-foundation/authentication.feature). The final Phase 1 H1 pack will add the visual contract, data-protection contract, exact platform matrix, environment manifest requirements, and version pins.

## Definition of done for the repository

The target repository is complete only when a clean clone can:

1. validate non-secret configuration and explain all human-only provider setup;
2. provision or connect an isolated Supabase environment from committed migrations/configuration;
3. build installable iOS and Android development plus release-like artifacts;
4. pass deterministic email, phone, session, RLS, deletion, lifecycle, error, accessibility, and visual scenarios;
5. pass bounded real Google and Apple provider canaries with synthetic identities and redacted evidence;
6. generate a fresh downstream app and repeat the critical suite without undocumented repair;
7. move through H1, independent verification, H2, final native QA, H3, and release preparation without an agent approving itself;
8. detect stale evidence, provider/config drift, repeated failures, secret exposure, and badly behaving agents through monitoring and audit.

## Explicitly later or optional

- passkeys, MFA, magic-link-only auth, anonymous accounts, enterprise SSO, and custom identity backends;
- automatic merging of phone, private-relay Apple, and unrelated email identities;
- public store release of a generated customer product;
- P2 envelope encryption or P3 E2EE for customer domain data;
- a generic component library unrelated to the auth and delivery foundations.

These require separate product decisions. They must not silently enter the base template.

## Human inputs still required before Phase 1 H1

- base organization/domain used for bundle IDs, application IDs, URL schemes, and universal/app links;
- final email behavior: password + verification as proposed, and whether magic link is also required;
- SMS provider, allowed test destinations, spending/rate limits, and production countries;
- Apple Developer team/App ID/Services ID strategy and whether Apple on Android is enabled by default;
- Google Cloud organization, OAuth clients, consent-screen brand, scopes, and test users;
- Supabase organization/project topology and account ownership;
- privacy policy, terms, support, and external account-deletion URL ownership;
- exact primary simulators/emulators, available physical devices, and provider-canary operator;
- maximum EAS, SMS, macOS runner, and device-farm budget.

No secret value belongs in this decision pack.

