# Phase 0 hardening — architecture decisions

Status: proposed for H1

## ADR-HARD-001 — strict JSON Schema runtime

**Decision:** pin Ajv `8.20.0` and `ajv-formats` `3.0.1`; instantiate the dedicated Draft 2020-12 class in strict mode and resolve all schemas offline from a registry.

Why: the repository already uses Draft 2020-12 schemas, Ajv exposes this draft through a separate class, and formats are intentionally a separate package. A single explicit validator removes the present mixture of JSON parsing and hand-written partial checks.

Alternatives:

- hand-written validation: rejected because it silently covers only remembered fields;
- a second schema library: rejected until a concrete missing capability appears;
- generated standalone validation code: useful later for cold-start or packaging constraints, but unnecessary for the current Node-only control plane.

Consequences: dependencies and lockfile enter the trust surface. CI must use `npm ci`, schema compilation becomes a startup check, and draft upgrades require a separate approved change.

## ADR-HARD-002 — schema coverage registry

**Decision:** maintain one explicit registry of artifact matchers, schema IDs, ownership, and narrow exclusions. Coverage must be exactly one mapping per controlled JSON artifact.

Why: validating only a curated list creates a false-green path whenever a new JSON file is added. The registry turns absence and ambiguity into testable failures.

Consequences: generated local run data is validated on read/write rather than committed. Exclusions require owner, reason, and expiry. Repository discovery rules must skip dependency, Git, build, and redacted raw-evidence directories deliberately.

## ADR-HARD-003 — GitHub protected environments for H1/H2/H3

**Decision:** use a trusted GitHub Actions gate workflow and separate protected environments named `h1-specification`, `h2-acceptance`, and `h3-release`. Enable required reviewers, prevent self-review, and disable administrator bypass. Verify review history through the GitHub API before each state transition.

Why: the existing local command proves only that text was entered. GitHub environments provide an external identity-bearing approval event and can prevent the deployment initiator from approving the same job. Binding remains our responsibility, so the trusted workflow inputs carry the exact run, gate, revision, digests, commit, request ID, and expiry.

Alternatives:

- local SSH signature: rejected because the currently available SSH key is accessible to the automation context and is therefore not human-only evidence;
- pull-request approval or issue comment: insufficient by itself because it is not inherently bound to a gate request and can be emitted by an over-privileged agent identity;
- custom passkey/WebAuthn service: strongest product-originated option, deferred until GitHub integration is proven insufficient.

Consequences: repository environment configuration becomes required operator evidence. Provider outage blocks the gate. A review approval is necessary but not sufficient unless every bound field and reviewer rule verifies.

## ADR-HARD-004 — identity and permission split

**Decision:** the agent uses a dedicated GitHub App installation with repository-scoped, least-privileged permissions. The human uses the `kapIsWizard` account. The current SSH key is human/bootstrap identity only and must not be configured as the agent's operational identity.

The agent app may create branches, commits, pull requests, and gate requests only where allowed. It cannot review its own request, modify protected default-branch policy directly, administer environments, read signing secrets, or bypass required checks. Installation tokens are minted just in time and never written to evidence. The workflow token is read-only by default and GitHub Actions is not permitted to approve pull requests.

Protected paths include `.github/`, `.agentic/`, validation code, approval adapters, policy/configuration, schemas, negative fixtures, and CODEOWNERS. Changes require human-owned review and default-branch checks before becoming trusted.

## ADR-HARD-005 — workflow-aware preflight

**Decision:** workflow definitions name a preflight profile and policy validates allowed pairings. Add a `harden-control-plane` profile for repository control-plane changes; retain native profiles for mobile work.

Why: readiness is contextual. A control-plane change should prove Node, CI, schema, and provider configuration, while a mobile change must prove native toolchains, devices, build identity, fixtures, and backend boundaries. One universal manifest either lies or becomes unusably optional.

## ADR-HARD-006 — observability boundary

**Decision:** defer OpenTelemetry export to Phase 2. Phase 1 continues to require structured JSONL events, durable run state, failure signatures, iteration/time/tool budgets, circuit breakers, monitoring, and an independent behavior audit.

Why: an exporter changes transport and operations but does not close the two current trust gaps. Adding it now increases bootstrap scope without making approvals or contracts credible.

Revisit when parallel/remote executions or cross-run service-level objectives require a shared telemetry backend.

## Trust boundary summary

| Actor/system | May do | Must not do |
|---|---|---|
| Human reviewer | approve protected environment, review trust-root changes, perform H2/H3 | share reviewer credentials with agent |
| Agent GitHub App | create scoped changes and approval requests | approve, administer environments, bypass protection |
| Gate workflow | present immutable request and expose provider evidence | rewrite request fields or trust feature-branch policy |
| Workflow token | read metadata and run required checks | approve PRs or gain broad write permission |
| Local kernel | verify, persist provenance, enforce transitions | treat local text as enforced human identity |
| GitHub | source external reviewer/run facts | decide our digest-binding policy implicitly |

