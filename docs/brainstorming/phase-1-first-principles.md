# Phase 1 brainstorming — prove the delivery spine

Status: discussion draft before Phase 1 H1

## First-principles objective

Phase 1 should answer one question: **can this repository repeatedly turn an approved business scenario into trustworthy iOS and Android evidence without a human babysitting every tool call or an agent bypassing human judgment?**

It should not maximize feature count. A small native feature with authentication, persistence, authorization, offline recovery, cold-start routing, visual states, secure session storage, backend oracles, two native platforms, and a release-like artifact exercises nearly every hard boundary.

The existing private-notes spike is a good test subject, but the present specification combines three uncertainties:

1. whether the agentic control plane works;
2. whether the native toolchain and `agent-device` work on both platforms;
3. whether the product/data architecture is correct.

We should sequence them so a failure has one likely owner.

## Proposed sequence

### Phase 1A — delivery-spine canary

Build the smallest complete vertical slice under the existing P0/P1 protection boundary:

- email/password fixture authentication;
- owner-only note create, list, open, and persistence after restart;
- cross-user RLS denial proven by a backend oracle;
- cold-start deep link;
- offline submit failure with preserved input and idempotent retry;
- default, loading, error, and populated visual states;
- P1 platform-protected session credentials and no unintended plaintext sinks;
- release-like iOS simulator and Android emulator builds;
- deterministic `.ad` scenarios run by `agent-device`;
- H1 specification, H2 evidence acceptance, and a dry-run H3 over exact internal artifacts;
- one deliberate native/tooling failure classified and recovered without weakening tests.

Do not add collaboration, push, social login, rich text, background sync, analytics, or public stores. Those add breadth, not confidence in the spine.

### Phase 1B — one security-boundary variant

Only after 1A is repeatable, choose one separate critical run:

- **P2 backend envelope encryption** if the threat is database dumps or storage-layer compromise while the backend remains trusted; or
- **P3 client E2EE** if service operators must not read note content.

Do not claim or build both at once. P3 changes recovery, multi-device key transfer, search, sharing, observability, backups, incident response, and test oracles. It is a product architecture, not a library toggle.

## Recommended repository shape

Keep the agentic control plane at the repository root and place the canary product beneath it:

```text
apps/
  reference-mobile/       Expo/React Native application
packages/
  contracts/              shared schemas and typed boundaries when proven useful
  test-fixtures/           deterministic, non-secret fixture definitions
  design-tokens/           platform-aware tokens after the visual contract is approved
.agentic/                  state machine, policies, schemas, workflow definitions
docs/                      guidebook, requirements, decisions, evidence indexes
```

This makes the repository reusable as a factory without confusing the reference app with the control plane. Do not create shared packages until two consumers or a real boundary exists.

Package-manager choice remains open until the pinned upstream template is inspected at the selected commit. Prefer one workspace manager and one lockfile for the whole repository; do not maintain npm at the root and a second unresolved dependency graph in the app without an explicit reason.

## Native verification ladder

Use escalating cost and realism:

1. Linux/host checks: types, lint, unit, schema, migration and RLS integration tests.
2. Local native canary: one pinned iOS simulator and one pinned Android emulator, development build, `agent-device` smoke.
3. Release-mode local/internal builds: native configuration fingerprints, cold start, lifecycle, permissions, deep link, storage, network recovery.
4. Scheduled matrix: additional supported OS/device profiles only after the primary pair is stable.
5. H2 physical-device/manual accessibility smoke where automation cannot supply trustworthy evidence.
6. H3 exact internal-distribution artifacts, then only a human-authorized release workflow.

iOS and Android results are independent. Passing one platform, Expo Go, or a web rendering never proves the other native platform.

## Backend and fixtures

Recommended topology:

- local Supabase for fast PR migration/RLS/integration checks;
- an isolated hosted E2E project for device and internal-artifact verification when the application cannot reliably reach local services;
- the same migrations, RLS policies, and deterministic fixture contract in both;
- two synthetic users, unique per-run data namespace, idempotent seed/reset, and an oracle with no production access;
- no service-role credential in the application bundle or captured evidence.

A local-only backend is cheaper but can hide networking, TLS, lifecycle, and remote-build problems. A hosted-only backend is slower, costs more, and makes fixture isolation harder. The dual topology is justified only if drift is continuously tested.

## Visual truth

For 1A, the committed SVG plus visual contract can be the approved independent source. The implementation screenshot must never update its own reference. Verification should combine semantic assertions with normalized regional comparison; full-screen pixel identity across iOS and Android is a false target.

If live Figma becomes the design source, install and configure the Figma connector as a separate trust decision, pin node/frame/version identifiers in the specification, export durable references, and retain a human visual H2. Figma access is useful, but it is not required to prove the first pipeline.

## Agent roles and loop prevention

- Specifier freezes business intent, Gherkin, oracles, visual source, platform differences, and open human decisions.
- Builder changes product code only after H1.
- React Native debugger diagnoses native/build/device failures and does not weaken acceptance criteria.
- `agent-device` operator records deterministic device evidence and does not judge product acceptance.
- Independent verifier maps evidence to each scenario and reports `verified`, `partially-verified`, or `failed` without editing implementation.
- Reviewer inspects architecture, security, native behavior, tests, and release impact without applying fixes.
- Release operator handles exact artifacts only after H2/H3.
- Behavior auditor detects loops, false success, scope drift, baseline manipulation, and role violations.

The orchestrator owns budgets and transitions, not truth. Two occurrences of the same stable failure signature open the circuit breaker. A debugger may propose a diagnosed fix; a builder applies it in a new bounded iteration; the independent verifier reruns the original oracle. No role gets to both change the criterion and declare it passed.

## Minimum observability for Phase 1

Keep structured local events as the required source:

- run, workflow, state, revision, risk, actor/role, action, timestamps;
- artifact digests, commit/build IDs, environment and device fingerprints;
- tool, attempt, duration, token/cost class where available;
- failure category and stable signature;
- scenario result, oracle result, evidence references, and redaction status;
- gate request/provenance without secret values;
- circuit-breaker and budget state.

Monitor invariants continuously and run the behavior audit after implementation, verification, review, and release preparation. Add OpenTelemetry in Phase 2 when remote/concurrent runs make cross-machine aggregation worth operating.

## Decisions needed before revising Phase 1 H1

1. **Product security boundary:** accept P0 note storage + P1 session storage for 1A, or redesign Phase 1 around P2/P3 before code exists.
2. **App identity:** product name, slug, iOS bundle ID, Android application ID, URL scheme, and owner accounts.
3. **Repository layout:** accept `apps/reference-mobile` with one workspace lockfile.
4. **Backend topology:** local PR stack plus isolated hosted E2E, or one explicitly accepted alternative.
5. **Design source:** committed reference for 1A or live Figma as an H1 dependency.
6. **Device matrix:** exact primary iOS simulator, Android emulator, and available physical devices.
7. **Release scope:** internal artifacts/dry-run H3 only, or actual TestFlight/Play Internal distribution.
8. **Budget:** allowable EAS/macOS/device-farm cost and maximum attempts per platform.

## Phase 1 entry criteria

Do not move the existing Phase 1 run beyond H1 until:

- Phase 0 hardening has H2 evidence and the enforced approval path is active;
- the pinned upstream template has a recorded integration decision rather than an assumed copy;
- exact versions are researched from official sources and locked;
- `agent-device` is installed, pinned, and its local CLI contract is captured during environment preflight;
- iOS, Android, backend, signing, EAS, and fixture readiness are truthfully declared;
- the eight decisions above are resolved in a revised digest-bound specification.

## What success unlocks

Once 1A passes without bypasses, the same control plane can support bounded flows for creating an app, onboarding an existing app, implementing a feature, fixing a native bug, adding E2E, implementing a design, upgrading Expo, rotating encryption keys, and preparing a release. Until then, those are designed workflows, not yet proven capabilities.

