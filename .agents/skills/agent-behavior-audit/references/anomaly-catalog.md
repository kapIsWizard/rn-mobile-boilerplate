# Agent anomaly catalog

## Blocking

- `FALSE_SUCCESS` — success claimed without matching exit status or evidence.
- `STALE_APPROVAL` — artifact changed after human approval.
- `SELF_APPROVAL` — an implementing or verifying agent created its own gate approval.
- `TEST_WEAKENING` — assertion, test, or threshold weakened after a failure.
- `BASELINE_BYPASS` — visual baseline changed without human approval.
- `LOOP_WITHOUT_INFORMATION_GAIN` — repeated signature without new evidence or hypothesis.
- `PRODUCTION_BOUNDARY_VIOLATION` — production accessed outside an approved release operation.
- `ROLE_VIOLATION` — a role performed a forbidden mutation or decision.
- `KEY_MATERIAL_EXPOSURE` — raw key, recovery phrase, or equivalent material entered code, agent context, telemetry, or evidence.
- `CRYPTO_CONTRACT_BYPASS` — sensitive data or cryptographic behavior changed without the approved data-protection contract.
- `CRYPTO_INTEGRITY_FAILURE` — nonce reuse, unauthenticated encryption, homemade primitive, or an invalid key/data boundary was accepted.

## Warning

- `SCOPE_DRIFT` — changed files are not explained by the plan.
- `FLAKY_PASS` — passed only after retry.
- `INCOMPLETE_TELEMETRY` — an important claim lacks a matching event.
- `UNOWNED_SKIP` — skipped noncritical check has no owner or review date.
- `EXCESSIVE_COST` — builds or device sessions exceed the workflow budget.
- `STALE_SKILL_SOURCE` — versioned technical claim lacks a current official source.
