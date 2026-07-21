---
name: agentic-orchestrate
description: Orchestrate evidence-driven Expo and React Native work through risk classification, durable run state, bounded iterations, role separation, and human gates. Use for creating an app, onboarding an existing app, implementing a feature, adding E2E coverage, preparing a release, resuming interrupted work, or coordinating any task that must move through specification, verification, acceptance, and release states.
---

# Agentic Orchestrator

Coordinate work; do not implement every responsibility yourself. Treat `.agentic/runs/<run-id>/state.json` as the machine source of truth.

## Start or resume

1. Read `AGENTS.md`, `.agentic/config.json`, the selected workflow, and the active run if one exists.
2. Resume an existing non-terminal run when its name and objective match. Do not create a parallel run for the same objective.
3. Otherwise initialize a run with `npm run agentic -- init --name <name> --risk <profile> --workflow <workflow>`.
4. Classify risk as `fast`, `standard`, or `critical`. Escalate automatically for auth, payments, sensitive data, migrations, native dependencies, permissions, background work, OTA, or store configuration.

## Route the workflow

1. Move to `SPEC_PENDING` and prepare the specification plus business acceptance scenarios.
2. Stop at the specification gate. A human must approve the current specification digest.
3. Move through `PREFLIGHTING`. Require a ready environment manifest with toolchains, isolated services, application IDs, device canaries, credential inventory without values, and no production access before `PLANNED`.
4. Plan and implement only approved scope.
5. Route failures through classification before choosing a debugger or builder.
6. Require an evidence digest before moving from verification to review.
7. Stop at functional acceptance and final release QA. Never synthesize human approval.
8. Invalidate downstream assumptions when a digest changes; the kernel invalidates stored approvals automatically.

## Control loops

- Require new evidence or a materially different hypothesis for each retry.
- Record each failure with a stable signature.
- Stop when the circuit breaker opens or an attempt budget is exhausted.
- Do not bypass `BLOCKED`. Resume only after a human decision with a reason.
- Treat rejected acceptance as a new revision, not an untracked loop.

## Preserve role separation

- Builder: implement.
- React Native debugger: reproduce and diagnose.
- Device operator: control devices and collect artifacts.
- Verifier: judge evidence and classify failures.
- Reviewer: inspect without silently implementing fixes.
- Human: approve specification, acceptance, and release.

Never infer one platform, device class, build profile, or backend authorization result from another. Manual operator work must use a build-bound checklist with evidence.

## Report

Return the current state, revision, risk, completed evidence, unresolved risks, next gate, and the exact decision required from the human. Never report `verified` when a required check is skipped.

Read [human-gates.md](references/human-gates.md) before preparing any human checkpoint.
