# Agentic mobile delivery system

## Objective

Turn approved business intent into an installed, verified, human-accepted native application artifact. Agents automate research, implementation, diagnosis, verification, and evidence collection. Humans retain product and release responsibility.

## Invariants

1. Source code is not the final product; the native binary, backend, environment, and device state are part of it.
2. An agent claim is not evidence.
3. A test without an observable oracle does not prove a business outcome.
4. Verification depth follows risk.
5. Builders cannot approve their own work.
6. Automatic loops are bounded and require information gain.
7. Production release requires human approval of an exact release candidate.
8. Sensitive data protection starts with a plaintext inventory and threat model; cryptographic choices and key lifecycle are H1 inputs, not builder improvisation.
9. Agents may observe key metadata, never raw production key material.

## State and revision model

The active state is stored in `.agentic/runs/<run-id>/state.json`. A transition is accepted only when it exists in `.agentic/policies/state-machine.json` and its digest or human gate requirements are satisfied.

Specification rejection and final QA rejection create a new revision. They are not invisible backward transitions. Digest changes invalidate downstream approvals:

| Changed digest | Invalidated approvals |
|---|---|
| Specification | specification, acceptance, release |
| Environment readiness | acceptance, release |
| Evidence | acceptance, release |
| Release artifact | release |

After H1, `PREFLIGHTING` records a non-secret environment manifest. Planning is blocked until required toolchains, device targets, application identifiers, isolated services, and credential ownership are ready with no production access. H2 and H3 bind this environment digest as well as specification and evidence.

## Human gates

### H1 — specification

Approve the problem, scope, business scenarios, design source, platform differences, risk, and manual checks before planning or implementation.

### H2 — functional acceptance

Review behavior, native replay, backend effects, visual comparison, deviations, unresolved risks, and manual checks after independent verification.

### H3 — final QA

Review the exact binary distributed through TestFlight or Google Play Internal. The approval binds commit, build ID, native fingerprint, backend revision, and evidence digest. Any change creates a new release candidate.

## Failure handling

Classify before fixing: product, test, fixture, build, environment, device, external service, or unknown. The same stable failure signature twice opens the circuit breaker. Iteration budgets apply independently to implementation, review, visual work, environment recovery, debugging, and release candidates.

The human resumes a blocked run with an explicit reason. If a budget was exhausted, resume requires a new positive bucket limit. Lifetime attempts remain immutable while a new bounded window begins at the previous total; agents cannot reset history or clear the breaker through another tool.

## Role topology

| Role | Project skill | May not do |
|---|---|---|
| Orchestrator | `agentic-orchestrate` | implement every role or synthesize approval |
| Specification author | `mobile-specify` | implement or record H1 |
| Builder | `expo-react-native-build` | approve, review itself, or weaken proof |
| Debugger | `react-native-debug` | fix before classifying the failing layer |
| Device operator | `agent-device-verify` | change product code or acceptance criteria |
| Evidence verifier | `mobile-evidence-verify` | implement fixes or omit required oracles |
| Change reviewer | `mobile-change-review` | silently repair its own findings |
| Documentation researcher | `mobile-docs-research` | mutate systems or treat memory as current docs |
| Data-protection architect | `mobile-data-protection` | implement, self-verify, approve, or handle raw production keys |
| Release operator | `native-release-operate` | approve or replace an artifact after H3 |
| Behavior auditor | `agent-behavior-audit` | modify the run it audits |
| Human | interaction surface | delegate product or release accountability to an agent |

## Monitoring

Every kernel event is attributed to a role and actor and appended to per-run and repository JSONL telemetry. `npm run agentic:monitor` audits all runs, blocks duplicate active objectives, checks gate and state invariants, re-hashes specification, environment, evidence, and release sources, reports retries or failures without evidence, and warns when active machine work goes silent. Human-wait states do not create false stale-run alarms.

Any role that observes a configured forbidden signal records `agentic violation` with redacted evidence. The kernel immediately opens the circuit breaker and the monitor retains a blocking `GUARDRAIL_VIOLATION`; only a named human can resume the run after remediation.

This is enforcement in the local control plane, not full production observability. Human approvals use a trusted-main GitHub workflow and protected environments; the adapter re-fetches policy, run, and review evidence before transitions. OpenTelemetry export, cost budgets, device leases, and external alerts remain roadmap work.

## Evidence graph

Each business requirement should be traceable to a scenario, implementation unit, automated checks, native replay, optional backend oracle, optional visual contract, platform result, and human decision. Gherkin describes business behavior; selectors and device commands remain in `.ad` files and manifests.

## Trust boundaries

- MCP is interactive and may be unavailable. CI uses pinned CLIs or APIs.
- Supabase MCP is development/test scoped and read-only by default.
- Device artifacts may contain credentials or personal data and are ignored by git.
- Approval files are audit records, not identity by themselves. Enforced gates require exact, unexpired GitHub protected-environment evidence from an allowlisted human distinct from the requesting GitHub App, with trusted-main policy and single-use consumption.
- Store submission, production migrations, credentials, rollout, and baseline changes are gated operations.
- RLS/authorization, provider at-rest encryption, local secure storage, server envelope encryption, and client E2EE are separate claims with separate oracles.
- Data-protection contracts live inside the specification digest; environment manifests carry key aliases/versions/owners only and must deny raw or production key access.
