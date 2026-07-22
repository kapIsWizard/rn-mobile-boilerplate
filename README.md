# Mobilka — agentic delivery for native apps

This repository is the control plane for building, verifying, and releasing native Expo/React Native applications. It adapts the useful concepts from [`AIBiz-Automatyzacje/workspace-template-mobile`](https://github.com/AIBiz-Automatyzacje/workspace-template-mobile) and uses [`agent-device`](https://agent-device.dev/) as the only native E2E driver.

The system is intentionally evidence-driven: source code is not considered delivered until an installed native artifact passes the required business, backend, device, and visual checks and the relevant human gate is recorded.

## Current status

The Phase 0 kernel and reusable trust-bootstrap hardening are implemented locally; Phase 0 remains open at H2 until the dedicated GitHub App, protected environments, trusted-main canary, and human acceptance are proven:

- deterministic workflow state and revision model;
- externally verifiable GitHub protected-environment gates for specification, functional acceptance, and final release QA, plus one allowlisted local bootstrap H1;
- reusable approval schemas plus a generated per-repository policy/CODEOWNERS binding, with immutable GitHub identity resolution, origin checks, explicit trust rotation, and fail-closed clean-clone validation;
- strict Draft 2020-12 JSON Schema ownership and validation for controlled JSON, with focused negative fixtures;
- workflow-aware control-plane and native preflight profiles;
- artifact-digest invalidation of stale approvals;
- an environment-readiness gate that blocks planning until native toolchains, devices, isolated services, IDs, and secret boundaries are proven;
- bounded retries, failure taxonomy, and circuit breakers;
- workflow audit telemetry;
- role-separated project skills for specification, orchestration, implementation, React Native debugging, `agent-device` operation, independent verification, review, documentation research, native release, and agent-behavior auditing;
- a first-principles data-protection model with P0–P4 patterns, a dedicated security-architect skill, H1-bound contracts, key-metadata-only preflight, cryptographic evidence, and a gated key-rotation workflow;
- starter workflows for a new app, an existing app, feature development, E2E coverage, design implementation, bug fixing, release, Expo SDK upgrades, and control-plane hardening.

Phase 1 targets the reusable authentication boilerplate described in [`docs/product/boilerplate-north-star.md`](docs/product/boilerplate-north-star.md), with email, phone, Google, and Apple registration/login. The earlier private-notes spike is superseded and is retained only as historical specification material.

## Verify the control plane

Requires Node.js 22 or newer. Install the exact reviewed validator graph from the lockfile.

```bash
npm ci
npm run agentic:check
npm run agentic:monitor
```

## Bind a downstream repository

The committed policy in this repository is an installation-specific trust root, not a template constant. In a new clone, a human operator first supplies a short-lived metadata token through the process environment and reviews the default dry-run:

```bash
npm run agentic -- bootstrap-trust \
  --reviewers reviewer-login \
  --metadata-token-env GITHUB_TOKEN
```

The operator repeats the command with `--apply` only after checking the resolved repository, immutable reviewer IDs, and generated CODEOWNERS. If the GitHub App already exists, `--agent delivery-app[bot]` also binds its immutable identity; adding it later or rotating any existing binding additionally requires `--rebind`. The applied configuration stays in safe bootstrap mode until the protected GitHub controls are proven; see [`docs/operations/github-human-gates.md`](docs/operations/github-human-gates.md).

## Start a controlled run

```bash
npm run agentic -- init \
  --name phase-1-critical-spike \
  --risk critical \
  --workflow create-app

npm run agentic -- transition .agentic/runs/<run-id> --to SPEC_PENDING
npm run agentic -- digest .agentic/runs/<run-id> \
  --kind spec \
  --path docs/requirements/phase-1-critical-spike
```

At that point work stops for H1. The local `approve` command is development-only and restricted to the explicit Phase 0 bootstrap specification run. Normal H1/H2/H3 use the GitHub protected-environment request and verifier described in [`docs/operations/github-human-gates.md`](docs/operations/github-human-gates.md).

## Repository map

- [`AGENTS.md`](AGENTS.md) — non-negotiable operating rules.
- [`.agentic/`](.agentic/) — policies, schemas, workflows, run state, and telemetry.
- [`.agents/skills/`](.agents/skills/) — role-specific Codex skills.
- [`acceptance/templates/`](acceptance/templates/) — Gherkin, scenario, visual, and evidence contracts.
- [`environment/templates/`](environment/templates/) — non-secret native readiness manifests.
- [`security/templates/`](security/templates/) — blocked-by-default data-protection contract templates.
- [`docs/guidebook/data-encryption-patterns.md`](docs/guidebook/data-encryption-patterns.md) — mobile encryption, secure storage, envelope/E2EE, key lifecycle, and verification patterns.
- [`docs/architecture/agentic-system.md`](docs/architecture/agentic-system.md) — architecture and trust boundaries.
- [`docs/roadmap.md`](docs/roadmap.md) — implementation sequence.
- [`upstream/workspace-template-mobile.lock.json`](upstream/workspace-template-mobile.lock.json) — pinned upstream revision and adaptation strategy.

Raw run evidence, device artifacts, credentials, and personal data are intentionally excluded from git.
