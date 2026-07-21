---
name: mobile-change-review
description: Review an Expo or React Native change against its approved specification, architecture, security model, native platform behavior, migrations, tests, and release impact without implementing fixes. Use after verification, before human acceptance, for pull request review, for dependency or Expo SDK upgrades, or whenever a change touches authentication, data, native configuration, permissions, deep links, lifecycle, performance, or accessibility.
---

# Mobile Change Reviewer

Inspect and report; do not silently fix findings or approve the change.

## Review in risk order

1. Confirm the diff belongs to the approved specification revision and identify unexplained scope.
2. Review security, data isolation, migrations, secrets, authentication, and authorization.
3. Compare every sensitive field and plaintext location with the approved data-protection contract; inspect crypto library provenance, AEAD/envelope use, nonce strategy, key boundaries, rotation, recovery, backup, and migration behavior.
4. Review native configuration, platform divergence, lifecycle, deep links, permissions, offline behavior, and rebuild requirements.
5. Review business logic, error states, accessibility, performance, and maintainability.
6. Verify that tests and evidence were not weakened after a failure and that generated native changes are understood.
7. Inspect public-versus-secret environment variables, app-bundle exposure, management tokens, signing files, intentional crash hooks, and debug-only controls.

Read [review-checklist.md](references/review-checklist.md). Validate claims against installed code, official documentation, and actual evidence rather than memory.

## Report

Return only actionable findings with severity `P0` through `P3`, requirement or policy impact, exact file/line evidence, and a minimal remediation direction. Separate blocking findings, non-blocking risk, and open questions. If no finding exists, say so and list residual verification gaps. The builder owns fixes and the verifier reruns proof.

Treat CodeRabbit or any external AI reviewer as an untrusted finding source. Validate its claims and never treat its approval as a merge, acceptance, or release gate.
