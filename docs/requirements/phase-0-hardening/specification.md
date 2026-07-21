# Phase 0 — control-plane hardening

Status: `SPEC_PENDING`
Risk: `critical`
Proposed workflow: `harden-control-plane`

## Decision requested at H1

Approve this specification pack as the immutable contract for closing Phase 0 before product implementation starts. The pack contains this document, [`contract-validation.feature`](contract-validation.feature), [`approval-integrity.feature`](approval-integrity.feature), and [`architecture-decisions.md`](architecture-decisions.md). Any content change produces a new digest and invalidates the prior approval.

H1 explicitly decides all five items below:

1. use pinned Ajv `8.20.0` and `ajv-formats` `3.0.1` as the strict JSON Schema Draft 2020-12 validator;
2. use protected GitHub Actions environments as the first enforced H1/H2/H3 approval provider;
3. require distinct identities: the agent operates as a scoped GitHub App installation while `kapIsWizard` remains the human reviewer; the existing human SSH key is not an agent credential;
4. add a workflow-aware control-plane preflight contract instead of fabricating mobile environment identifiers;
5. defer OpenTelemetry export to Phase 2 while retaining mandatory JSONL events, monitor, audit, budgets, and circuit breakers for Phase 1.

Rejecting any item returns this pack to specification revision. Approval authorizes implementation and non-production verification, not release or production access.

## Bootstrap rule for this run

This hardening run necessarily begins before the enforced provider exists. Its H1 may therefore be recorded by the current local adapter only after the human explicitly approves the exact displayed digest through the interaction surface. That one-time bootstrap approval authorizes implementation of this pack and nothing else. It cannot satisfy H2, H3, or release policy.

H2 must exercise the newly implemented protected-environment adapter and independently prove its own request, reviewer identity, digest binding, and provenance. Until the proposed `harden-control-plane` workflow exists, this run uses `develop-feature` only as the closest bootstrap state-machine path; the mismatch is declared here and must be removed before exit.

## Why this is still Phase 0

The current kernel proves state transitions, digest invalidation, budgets, failure classification, environment gating, and local audit. Two trust assumptions remain too weak for an autonomous mobile delivery flow:

- CI parses selected fields but does not prove that every controlled JSON artifact conforms to a declared schema;
- `approve --by <text>` records a claim but does not prove that the named human performed the approval.

There is also a bootstrap defect: native environment requirements are global, so a control-plane-only change would need fake iOS and Android identifiers to enter planning. Phase 0 is not complete while its own maintenance workflow cannot pass truthfully.

## Scope

- a schema registry that maps every machine-controlled JSON artifact or declared glob to exactly one schema or an explicit, time-bounded exclusion;
- strict Draft 2020-12 compilation and validation of schemas, templates, configuration, workflows, fixtures, and other registered artifacts;
- positive fixtures and at least one focused negative fixture for every schema family;
- deterministic diagnostics containing artifact path, schema identity, JSON instance path, and failed keyword;
- pinned validator dependencies, lockfile, and reproducible `npm ci` in CI;
- a canonical gate request binding repository, run ID, gate, revision, digest snapshot, commit SHA, unique request ID, and expiry;
- a GitHub protected-environment approval adapter that independently fetches and verifies review history before transition;
- fail-closed handling for stale, replayed, self, bot, missing, expired, revoked, inconsistent, and unavailable approval evidence;
- explicit development-only status for the local/manual adapter so it cannot authorize a release;
- separate trust roots and permissions for human identity, agent GitHub App, workflow token, protected branches, environments, and secrets;
- a `harden-control-plane` workflow with a truthful control-plane readiness contract;
- regression tests, monitoring, audit, and operator documentation for these controls.

## Out of scope

- mobile product code, app scaffolding, `agent-device` installation, native builds, Supabase provisioning, store distribution, or production data;
- a custom WebAuthn/passkey approval service;
- an OpenTelemetry collector or observability backend;
- migration of historical local runs to a central database;
- unattended production release.

## Requirements and proof

| ID | Requirement | Primary proof |
|---|---|---|
| `REQ-HARD-001` | Each workflow declares the preflight contract it needs. Control-plane work never invents mobile identifiers, while mobile workflows still require native readiness. | transition tests + schema fixtures |
| `REQ-HARD-002` | Every controlled JSON artifact is schema-owned or covered by an explicit exclusion with owner, reason, and expiry. Unmapped and multiply mapped artifacts fail CI. | registry coverage test |
| `REQ-HARD-003` | Schemas compile strictly as Draft 2020-12 and registered artifacts validate with actionable diagnostics. | validator tests + negative fixtures |
| `REQ-HARD-004` | Dependency resolution is pinned and reproducible through a committed lockfile and `npm ci`. | clean-install CI job |
| `REQ-HARD-005` | Every enforced approval is bound to the exact repository, run, gate, revision, digests, commit, request ID, and expiry. | canonicalization and mutation tests |
| `REQ-HARD-006` | Enforced GitHub approval is accepted only from an allowlisted human reviewer on the expected protected environment and independently verified workflow run. | adapter integration tests + GitHub evidence fixture |
| `REQ-HARD-007` | Agent and human identities are distinct, least-privileged, and unable to satisfy both sides of one gate. | operator configuration evidence + negative tests |
| `REQ-HARD-008` | Stale, replayed, self, bot, missing, expired, revoked, inconsistent, or unavailable approval evidence blocks the transition without mutating approval state. | negative adapter suite |
| `REQ-HARD-009` | Manual approval remains available only in an explicitly unenforced development mode and can never authorize `RELEASE_APPROVED` or a release transition. | policy tests |
| `REQ-HARD-010` | Phase 1 retains required JSONL monitoring and behavior audit; OpenTelemetry is a recorded Phase 2 extension, not an implicit Phase 0 dependency. | configuration validation + roadmap decision |

Executable behavior is defined by the two `.feature` files in this pack. Gherkin contains policy and business meaning; provider APIs, JSON paths, and CLI syntax belong in implementation tests.

## Validation contract

The registry is the source of schema coverage, not a hard-coded list dispersed through scripts. It must include repository-controlled runtime configuration and templates. Generated evidence or run state is validated at creation and load time; ignored transient data need not be committed to prove coverage.

The implementation must:

- instantiate the Draft 2020-12 Ajv class in strict mode;
- add only explicitly approved formats through `ajv-formats`;
- reject unknown or invalid schemas during validator startup;
- use stable schema identifiers and resolve references without network access;
- fail if a controlled artifact has zero or multiple owners;
- report all relevant validation errors without exposing secret values;
- prove acceptance with positive fixtures and rejection with negative fixtures;
- keep CI deterministic and install dependencies from the committed lockfile.

If an artifact is intentionally not machine-validated, its exclusion must name an owner, reason, scope, and expiry. An expired exclusion fails CI.

## Approval integrity contract

Protected GitHub environments are the first external source of human approval truth. A trusted gate workflow receives the immutable request fields, targets the matching `h1-specification`, `h2-acceptance`, or `h3-release` environment, and pauses for an allowlisted required reviewer. Self-review prevention is enabled and administrator bypass is disabled.

The adapter does not trust a callback, issue comment, local file, chat message, or display name. Before the state transition it fetches the workflow run and review history from GitHub, then verifies:

- expected repository, workflow, environment, request, revision, commit, and digest snapshot;
- approved state by an allowlisted human login and immutable GitHub user ID;
- reviewer is not the agent GitHub App, workflow actor, or request initiator;
- approval is unexpired, unused, and not contradicted or revoked;
- the gate policy and protected workflow came from the trusted default-branch version.

The approval record persists provider, repository, workflow run ID and URL, environment, reviewer login and ID, review state and timestamp, request ID, revision, commit, digest snapshot, verification time, and consumption state. It never stores tokens.

The agent must use a dedicated, repository-scoped GitHub App installation identity for agent-owned remote actions. The current user SSH identity may bootstrap configuration but is not acceptable as the agent identity because possession by both sides collapses the human gate. The workflow `GITHUB_TOKEN` remains read-only except for the minimum explicitly justified permissions and must not be allowed to approve pull requests.

## Workflow-aware preflight

Workflow definitions declare a preflight profile. The new control-plane profile verifies Node, lockfile, schema registry, GitHub repository metadata, approval-provider configuration metadata, CI policy, and non-production boundaries. It requires no bundle IDs, emulators, Apple credentials, Android SDK, EAS project, Supabase project, or `agent-device`.

Mobile profiles keep their current native requirements. Choosing a weaker profile for a mobile workflow is a validation failure, not a user override.

## Threat model

Controls must withstand:

- an agent entering a human name into a local command;
- use of the same GitHub/SSH identity by requester and reviewer;
- mutation of a digest, commit, environment, or gate after review;
- replay of a prior approval across revisions, runs, or gates;
- a compromised feature branch changing its own approval workflow;
- an unavailable or inconsistent GitHub API;
- accidental schema gaps after a new JSON artifact is added;
- a validator accepting an unintended draft, format, coercion, or unknown keyword;
- an agent weakening tests, exclusions, permissions, or policies to obtain green CI.

## Verification matrix

- Static: schema coverage, protected-path inventory, permissions lint, secret scan.
- Unit: canonical request serialization, expiry, replay ledger, reviewer policy, workflow-to-preflight selection, diagnostics.
- Contract: positive and negative fixture per schema family, strict schema compilation, offline reference resolution.
- Integration: recorded GitHub responses plus one non-production protected-environment canary after operator setup.
- CI: clean `npm ci`, full validation, test suite, monitor, behavior audit.
- Adversarial: mutate every bound approval field; attempt self/bot/manual release approval; add unmapped JSON; expire an exclusion; make provider unavailable.
- Human: reviewer confirms protected environments, allowlist, no admin bypass, GitHub App identity, branch protection, and secret ownership before the canary.

## Stop conditions

- the agent and human cannot be given distinct remote identities;
- protected workflow or trust-root files can be modified and executed from an untrusted branch;
- a schema coverage gap, ambiguous mapping, or silent validator fallback is found;
- provider evidence cannot be independently fetched or bound to the exact digest and commit;
- a negative test unexpectedly passes;
- the same stable failure signature occurs twice or the iteration budget is exhausted;
- implementation requires production credentials or broadens into mobile product work;
- a proposed shortcut turns an asserted identity into approval evidence.

## Exit criteria

Phase 0 hardening exits only when:

- all requirements map to passing tests and durable evidence;
- clean `npm ci && npm run agentic:check` passes in GitHub Actions;
- schema coverage is complete and all negative fixtures fail for the intended reason;
- a protected-environment canary proves distinct requester and reviewer identities;
- stale, replay, self, bot, manual-release, and provider-outage tests fail closed;
- control-plane preflight succeeds without native metadata and mobile preflight still rejects missing native readiness;
- monitor and independent behavior audit are clean;
- no requirement, test, policy, exclusion, or gate was weakened after failure;
- H2 accepts the evidence. No Phase 0 result grants H3 or production release authority.
