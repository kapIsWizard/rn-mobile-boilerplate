# Mobilka — agentic delivery for native apps

This repository is the control plane for building, verifying, and releasing native Expo/React Native applications. It adapts the useful concepts from [`AIBiz-Automatyzacje/workspace-template-mobile`](https://github.com/AIBiz-Automatyzacje/workspace-template-mobile) and uses [`agent-device`](https://agent-device.dev/) as the only native E2E driver.

The system is intentionally evidence-driven: source code is not considered delivered until an installed native artifact passes the required business, backend, device, and visual checks and the relevant human gate is recorded.

## Current status

Phase 0 is implemented:

- deterministic workflow state and revision model;
- human gates for specification, functional acceptance, and final release QA;
- artifact-digest invalidation of stale approvals;
- an environment-readiness gate that blocks planning until native toolchains, devices, isolated services, IDs, and secret boundaries are proven;
- bounded retries, failure taxonomy, and circuit breakers;
- workflow audit telemetry;
- role-separated project skills for specification, orchestration, implementation, React Native debugging, `agent-device` operation, independent verification, review, documentation research, native release, and agent-behavior auditing;
- a first-principles data-protection model with P0–P4 patterns, a dedicated security-architect skill, H1-bound contracts, key-metadata-only preflight, cryptographic evidence, and a gated key-rotation workflow;
- starter workflows for a new app, an existing app, feature development, E2E coverage, design implementation, bug fixing, release, and Expo SDK upgrades.

Phase 1 is a critical vertical spike. Its specification lives in [`docs/requirements/phase-1-critical-spike/specification.md`](docs/requirements/phase-1-critical-spike/specification.md) and must pass the H1 human gate before application scaffolding starts.

## Verify the control plane

Requires Node.js 22 or newer. There are no runtime package dependencies yet.

```bash
npm run agentic:check
npm run agentic:monitor
```

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

At that point work stops for H1. The `approve` command only records a decision already made by a human through the interaction surface; agents must never invoke it on a human's behalf.

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
