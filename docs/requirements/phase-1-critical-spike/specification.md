# Phase 1 — critical vertical spike

Status: `SPEC_PENDING`
Risk: `critical`
Workflow: `create-app`

## Decision requested at H1

Approve this specification pack as the immutable scope for the first native vertical slice. The pack contains this document, [`private-notes.feature`](private-notes.feature), [`data-protection-contract.json`](data-protection-contract.json), [`visual-contract.json`](visual-contract.json), and [`design-reference.svg`](design-reference.svg). A digest change invalidates the approval.

H1 must explicitly accept the proposed hybrid protection boundary: P0 provider-managed at-rest protection plus RLS for note content, and P1 platform-protected storage for session credentials. Phase 1 is deliberately not field-level encrypted or E2EE; privileged Supabase/backend operators remain trusted plaintext processors. Rejecting that boundary returns the pack for a P2/P3 infrastructure and recovery redesign before implementation.

## Problem and proof objective

We do not yet know whether `agent-device`, isolated backend fixtures, native builds, artifact-bound approvals, and visual comparison can reliably prove a nontrivial Expo/React Native feature on both iOS and Android.

The spike is successful only when an authenticated user can create and reopen a private note, the backend proves row isolation and idempotency, a terminated application handles a deep link, and the UI can be compared with an independent approved reference.

## In scope

- one Expo/React Native TypeScript application;
- email/password test authentication against an isolated Supabase E2E environment;
- create, list, and open one private text note;
- owner-only access enforced by RLS rather than UI filtering;
- cold-start deep link to a note;
- actionable offline creation failure and safe manual retry;
- deterministic default, loading, error, and populated UI fixtures;
- installable development and release-like internal artifacts for iOS and Android;
- native E2E replay exclusively through `agent-device`;
- business, backend, visual, build, and device evidence bound to the run.

## Explicitly out of scope

- production deployment, public stores, real customer data, social login, password reset, collaboration, rich text, attachments, search, push notifications, background sync, conflict resolution, analytics, and offline-first queues;
- Expo Go as acceptance evidence;
- pixel-identical status bars, system fonts between platforms, and OS-owned permission dialogs;
- Maestro or a second E2E driver.

## Business requirements

| ID | Requirement | Primary proof |
|---|---|---|
| `REQ-NOTE-001` | The owner can create a valid private note and still see exactly one copy after terminating and reopening the app. | native replay + database row count |
| `REQ-NOTE-002` | A different authenticated user cannot read the owner's note or infer its contents. | RLS integration test + native replay |
| `REQ-NOTE-003` | Opening a valid note deep link from a terminated app shows the correct note after authentication restoration. | OS-level cold-start replay + route assertion |
| `REQ-NOTE-004` | Losing connectivity during creation shows an actionable error, preserves user input, and creates no duplicate after one retry. | network control + UI assertions + idempotency key/row count |
| `REQ-NOTE-005` | Default, loading, error, and populated states conform to the approved platform contract. | normalized screenshots + semantic and regional diff |
| `REQ-NOTE-006` | Confidential note content and session credentials do not persist or leak outside the locations allowed by the approved data-protection contract. | static/plaintext sink scan + platform storage/config proof + native lifecycle replay |

The executable business language is [`private-notes.feature`](private-notes.feature). Technical selectors and device commands will live in `.ad` files after H1; they must not leak into Gherkin.

## Technical baseline

- Expo managed workflow with development builds and generated native projects only when required by EAS/prebuild.
- Expo Router for typed application and deep-link routes.
- Supabase Auth, Postgres migrations, and explicit RLS policies in source control.
- TanStack Query for remote state and mutation lifecycle; no global state library until a demonstrated need exists.
- React Hook Form plus Zod at the form boundary.
- React Native `StyleSheet` plus typed design tokens for this spike; no pre-release styling framework.
- Jest, React Native Testing Library, and Supabase integration tests below the device layer.
- `agent-device` CLI/MCP for native exploration, deterministic `.ad` replay, screenshots, recordings, and device logs.
- EAS development/internal builds with separate bundle/application identifiers and environment variables per environment.
- GitHub Actions as the CI control plane; macOS/iOS execution and remote build credentials are introduced only after local canaries pass.

After H1 and before planning, the run enters `PREFLIGHTING`. A hashed environment manifest must prove both native toolchains, `agent-device`, isolated Supabase E2E, EAS project/build profiles, distinct `.e2e` application identifiers, fixture ownership, and credential metadata without values. It must explicitly deny production access.

Exact package versions will be selected from current stable official releases at scaffold time and committed to the lockfile. No agent may silently use an unpinned `@latest` dependency in CI.

## Data and security contract

`notes` contains an opaque ID, `owner_id`, title, body, idempotency key, and timestamps. RLS permits select/insert/update/delete only when `auth.uid() = owner_id`. The server/database enforces uniqueness for the owner's idempotency key. E2E uses two synthetic users and a dedicated project or isolated local stack. Service-role credentials never enter the application bundle, device logs, screenshots, or committed evidence.

The mobile client receives only the Supabase project URL and publishable key. Database passwords, secret/service-role keys, management tokens, OAuth client secrets, and signing material remain outside app-readable variables and agent evidence. This spike uses deterministic email/password fixtures; adding Apple or Google login is a separate critical specification, not implied by the supplied course materials.

The detailed, H1-bound decision is [`data-protection-contract.json`](data-protection-contract.json). Note content uses the P0 boundary: TLS, provider-managed storage encryption, RLS, minimal retention, and no unintended device persistence, but authorized Supabase/backend processes can read plaintext. Session credentials use P1 platform-protected local storage. P2 backend envelope encryption and P3 client E2EE are explicitly deferred because either would change the service boundary, data path, recovery model, multi-device behavior, and operational infrastructure. No agent may describe this spike as field-encrypted or E2EE.

## Platform contract

Both platforms implement the same information hierarchy and business behavior. iOS uses a large navigation title and rounded grouped surfaces. Android uses a compact top app bar, stronger elevation, and Material-shaped actions. Native back behavior, keyboard avoidance, safe areas, font metrics, and system status bars are judged per platform rather than forced into false pixel parity.

The approved visual source is [`design-reference.svg`](design-reference.svg); normalization and allowed differences are declared in [`visual-contract.json`](visual-contract.json). Updating either file after H1 invalidates specification approval. Updating a captured implementation image never updates the reference automatically.

## Verification matrix

- Static: formatting, TypeScript, dependency/config audit, secrets scan.
- Unit: validation, idempotency-key lifecycle, error mapping, route parsing.
- Integration: migrations, RLS owner access, cross-user denial, unique retry behavior.
- Data protection: secure-storage/config audit, plaintext marker scans across device and telemetry sinks, logout/reinstall behavior from the contract, TLS-only endpoints, and explicit proof of the backend plaintext trust boundary.
- Native build: release-like iOS simulator and Android emulator artifacts; Expo Go excluded.
- Device: all Gherkin scenarios replayed five consecutive times per platform with fixture reset declared.
- Visual: both platforms, required states, normalized locale `pl-PL`, light appearance, font scale `1`, portrait orientation, and fixed fixtures.
- Deliberate fault: one Metro/build/device failure must be preserved and correctly classified without changing product code.
- Manual: accessibility screen-reader pass and final physical-device smoke are reported separately and may remain `requires-human` until H2/H3.

## Evidence and acceptance

Every requirement maps to a scenario ID, implementation unit, lower-layer tests, `.ad` replay, backend oracle where applicable, visual artifact where applicable, platform result, and final human decision. A passing UI assertion without its required backend oracle is `partially-verified`, never `verified`.

H2 reviews the evidence bundle and deviations. H3 reviews the exact internal-distribution binaries bound to commit, build IDs, native fingerprints, backend revision, and evidence digest. Any change to these inputs invalidates the corresponding approval.

## Stop conditions

- the same stable failure signature occurs twice;
- an iteration budget is exhausted;
- an isolated environment, native toolchain, signing identity, or device is unavailable;
- a required oracle cannot be observed;
- an agent attempts to weaken a scenario, threshold, RLS policy, or visual reference after failure;
- an agent introduces cryptography, changes a plaintext location, reads raw key material, or changes recovery/backup behavior outside the approved data-protection contract;
- a requested change falls outside approved scope.
- an agent infers one platform, device class, build profile, or backend authorization result from another.

## Open infrastructure prerequisites

These do not change product behavior but block the relevant execution stage if unavailable:

- Apple developer/EAS credentials capable of producing an internal iOS artifact;
- Android signing/EAS credentials for an internal artifact;
- an isolated Supabase project or approved local-stack strategy;
- a macOS iOS simulator and Android emulator supported by the selected toolchain;
- an installed, pinned `agent-device` CLI version verified by its local help contract.

## Exit criteria

The spike exits only when both platform suites pass five consecutive runs, backend and visual oracles are complete, deliberate failures are classified correctly, stale approvals demonstrably fail, raw evidence is redacted, runtime/cost is measured, and H1, H2, and H3 occur without bypasses.
