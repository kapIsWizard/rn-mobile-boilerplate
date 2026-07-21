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
- [ ] Signed or product-originated approval adapter
- [ ] Full JSON Schema validation in CI
- [ ] OpenTelemetry exporter

Exit: state transitions, invalidation, loop breaking, and audit pass automated tests.

## Phase 1 — critical vertical spike

- Build a minimal Expo application with an isolated Supabase E2E environment.
- Implement auth plus an RLS-protected create/read flow.
- Add a cold-start deep link, offline failure, restart persistence, and platform-specific design state.
- Build installable iOS and Android artifacts.
- Author deterministic `.ad` scenarios.
- Prove the approved P0/P1 hybrid boundary, plaintext sink discipline, and cross-platform secure-storage behavior without claiming field encryption or E2EE.
- Repeat the suite five times per platform.
- Produce Figma/current/diff evidence.
- Trigger a deliberate device failure and prove correct classification.
- Exercise H1, H2, and H3 without bypasses.

Exit: one requirement travels from specification to internal release with a complete evidence bundle and known execution cost.

## Phase 2 — neutral orchestration

- Add workflow-specific policy composition.
- Add artifact dependency graph and selective approval invalidation.
- Add run resume after process interruption.
- Add role and capability authorization checks.
- Add cost, duration, and device lease budgets.

## Phase 3 — upstream adaptation

- Import the pinned upstream snapshot.
- Port ideation, brainstorming, planning, review, compound, and freshness concepts.
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
