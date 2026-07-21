# Specification checklist

- Problem, user, outcome, scope, non-scope, and terminology are explicit.
- Each requirement has a stable ID and at least one observable scenario.
- Gherkin describes behavior rather than taps, selectors, or implementation details.
- Positive, denial/security, error/recovery, lifecycle, and relevant permission paths exist.
- Backend effects, idempotency, deep links, cold start, offline behavior, and platform differences are covered when relevant.
- Design source, node or region, device, locale, appearance, font scale, fixtures, masks, and diff policy are fixed.
- Environments, synthetic identities, data reset, application IDs, and distribution profile are named.
- Sensitive fields, plaintext locations, threat actors, selected protection profile, key lifecycle, backup/reinstall behavior, residual privileged readers, and required crypto oracles are fixed in a data-protection contract.
- Password hashing, authorization/RLS, transport protection, local secret storage, provider at-rest encryption, field encryption, and E2EE are not conflated.
- Risk profile selects the verification matrix and manual checks.
- Unknowns that change product behavior are resolved by the human before H1.
- The whole pack can be hashed as one immutable approval input.
