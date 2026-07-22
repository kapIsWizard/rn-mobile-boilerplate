# Implementation roadmap

## Phase 0 — constitution and kernel

- [x] First-principles invariants
- [x] Risk profiles
- [x] State machine
- [x] Human approval digests
- [x] Failure taxonomy
- [x] Circuit breaker and attempt budgets
- [x] Run telemetry and deterministic audit
- [x] Artifact-source re-hashing before approvals and transitions
- [x] Environment-readiness gate between H1 and planning
- [x] Secret inventory without values and production-access boundary
- [x] P0–P4 data-protection patterns, key lifecycle, blocked-by-default contract, and H1 binding
- [x] Data-protection architect skill, key-metadata-only preflight, crypto evidence dimension, and key-rotation workflow
- [x] Repository monitor for duplicate objectives, stale work, and evidence-free retries
- [x] Role-separated specification, build, debug, device, verify, review, documentation, release, orchestration, and audit skills
- [x] GitHub protected-environment approval adapter with trusted-main policy, replay protection, and fail-closed verification
- [x] Full strict Draft 2020-12 JSON Schema validation and ownership in CI
- [ ] Operator setup and non-production protected-environment canary for Phase 0 H2
- [ ] OpenTelemetry exporter (deliberately deferred to Phase 2)

Exit: automated checks, monitor, and audit pass; the protected-environment canary proves distinct App/human identities; H2 accepts the exact evidence digest. No H3 or production authority is implied.

## Phase 1 — reusable authentication boilerplate

- Import and adapt the useful pinned upstream baseline into `apps/reference-mobile` before product scaffolding.
- Establish one workspace dependency graph, exact Expo/native versions, identifiers, environments, build profiles, and provider capability configuration.
- Implement the application-owned auth/session contract with Supabase as the default adapter.
- Implement email/password registration, verification, login, and recovery on iOS and Android.
- Implement deterministic phone OTP registration/login plus bounded real-SMS canary and abuse/rate controls.
- Implement Google on iOS/Android, native Apple on iOS, and capability-gated Apple on Android.
- Add protected profile RLS, secure session lifecycle, logout, account deletion, Apple revocation, and store deletion-link contract.
- Build installable development and release-like iOS/Android artifacts and author deterministic `.ad` scenarios.
- Prove P1 session protection, plaintext sink discipline, callback/nonce/state safety, identity-collision policy, and platform-specific behavior.
- Produce semantic, visual, backend, provider, storage, accessibility, build, device, and human-canary evidence.
- Generate a clean downstream application and repeat the critical suite without undocumented repair.
- Trigger deliberate native/provider failures and prove correct classification without weakening acceptance.
- Exercise H1, H2, and H3 without bypasses.

Exit: the clean boilerplate and one generated project satisfy the auth acceptance pack on iOS and Android with complete evidence and known execution cost.

## Phase 2 — neutral orchestration

- Add workflow-specific policy composition.
- Add artifact dependency graph and selective approval invalidation.
- Add run resume after process interruption.
- Add role and capability authorization checks.
- Add cost, duration, and device lease budgets.

## Phase 3 — remaining upstream workflow adaptation

- Audit the Phase 1 upstream import and update the pinned snapshot deliberately.
- Port remaining ideation, brainstorming, planning, review, compound, and freshness concepts.
- Rewrite execution and autopilot against this kernel.
- Replace all Maestro references and deliverables.
- Audit guidebook claims and remove web-only or pre-release defaults.

## Phase 4 — golden workflows

- [x] Create a new application.
- [x] Onboard an existing application.
- [x] Develop a feature.
- [x] Add E2E coverage.
- [x] Implement from a design contract.
- [x] Diagnose and fix a bug.
- [x] Release an application.
- [x] Upgrade Expo SDK.
- [ ] Execute each workflow end to end in the Phase 1 reference app.

## Phase 5 — native CI/CD

- Conditional native builds based on fingerprint.
- Android and macOS/iOS runners.
- Device leases, canary, cleanup, and artifact retention.
- Pull-request smoke, nightly cross-platform suite, and release suite.
- TestFlight, Google Play Internal, staged rollout, and rollback.

## Phase 6 — operations

- Sentry-driven incident flow.
- OTA versus binary hotfix decision.
- Expo SDK upgrade flow.
- Store readiness and privacy checks.
- Post-release product and reliability monitoring.

## Phase 7 — template self-test

Generate a clean application, build both native targets, install them, execute critical scenarios, and produce an acceptance report without undocumented setup.
