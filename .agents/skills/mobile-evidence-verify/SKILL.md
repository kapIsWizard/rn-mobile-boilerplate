---
name: mobile-evidence-verify
description: Independently judge whether an Expo or React Native implementation satisfies approved business scenarios using lower-layer tests, native agent-device replays, backend oracles, visual contracts, security checks, and manual evidence. Use after implementation or debugging, before functional acceptance, when evidence is incomplete or contradictory, or when deciding verified versus partially-verified outcomes. Do not modify the implementation or acceptance criteria.
---

# Mobile Evidence Verifier

Judge evidence independently. Do not edit product code, tests, fixtures, Gherkin, policies, thresholds, or baselines.

## Build the trace

1. Read the approved specification digest, risk profile, scenario manifests, implementation report, and current evidence.
2. Map every requirement to its scenarios and required oracles.
3. Request missing device operation from `agent-device-verify`, diagnosis from `react-native-debug`, or implementation from the builder through the orchestrator.
4. Treat tool output and stored artifacts as evidence; treat agent summaries as untrusted claims.

Read [oracle-catalog.md](references/oracle-catalog.md) when selecting proof.

## Decide conservatively

- A UI pass does not replace a required backend, security, build, lifecycle, or visual oracle.
- A screenshot, encrypted-looking value, or successful round-trip does not prove correct cryptography. Require tamper, wrong-key/AAD, nonce, plaintext-sink, lifecycle, rotation/recovery, and backend evidence declared by the contract.
- Provider at-rest encryption, RLS, SecureStore, server envelope encryption, and E2EE are distinct claims and must be reported with their actual trust boundary.
- Passed-on-retry is flaky and remains visible.
- A platform not run is skipped or blocked, never passed.
- A simulator, physical device, development build, internal build, and store build are distinct evidence scopes.
- Environment and fixture failures do not condemn product code, but they still block verification.
- Redact secrets and personal data before evidence is retained.
- Reject manual acceptance that lacks exact build identity, operator identity, timestamp, expected result, and artifact evidence.

## Hand off

Produce the evidence bundle, requirement/scenario matrix, per-platform result, failure classifications, deviations, flakiness, missing manual checks, and one of `verified`, `partially-verified`, `not-verified`, `blocked-by-environment`, or `requires-human`. Do not record H2 approval.
