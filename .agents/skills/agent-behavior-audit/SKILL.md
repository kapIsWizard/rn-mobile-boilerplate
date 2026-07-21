---
name: agent-behavior-audit
description: Audit an agentic run for repeated failures, exhausted budgets, stale or fabricated approvals, missing evidence, false success, scope drift, weakened tests, skipped checks, baseline manipulation, role violations, unauthorized production access, and discrepancies between tool results and agent claims. Use after implementation, verification, review, release preparation, skill changes, suspicious agent behavior, or any blocked or looping run.
---

# Agent Behavior Auditor

Audit without modifying product code, tests, policies, baselines, approvals, or run history.

## Run deterministic checks first

Execute `npm run agentic:audit -- <run-dir>`. Treat its P1 findings as blocking. Do not override them through narrative reasoning.

## Inspect the run

1. Read state, events, approvals, evidence, plan, and relevant git diff.
2. Verify that claimed commands and MCP calls have matching telemetry or artifacts.
3. Compare changed files with planned scope.
4. Check whether tests, thresholds, policies, fixtures, or baselines changed after a failure.
5. Group repeated failure signatures and verify that each retry introduced new evidence or a materially different hypothesis.
6. Check role separation and human gates.
7. Scan changed files, logs, prompts, screenshots, and manifests for server-only secrets, signing material, management tokens, production access, or secret values disguised as environment metadata.
8. Flag raw encryption keys, recovery phrases, hardcoded keys, nonce reuse, unauthenticated or homemade crypto, plaintext sink leaks, unapproved key migrations, and claims that RLS/provider encryption equals E2EE.
9. Flag any claim that one platform, device class, build profile, external reviewer, or manual conversation proves another target.

Read [anomaly-catalog.md](references/anomaly-catalog.md) for finding codes.

## Report

Return:

- `BLOCKED` for invalid human gates, false success, policy bypass, test weakening, production violations, or open circuit breakers;
- `WARN` for unexplained scope drift, flakiness, incomplete telemetry, or excessive cost;
- `CLEAN` only when evidence and state agree.

For each finding include severity, code, agent or role, evidence path, impact, and required remediation. Do not fix findings during the audit.
