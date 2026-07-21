---
name: mobile-specify
description: Turn a mobile product idea, existing-app change, bug, design, or E2E request into an approvable Expo/React Native specification pack with bounded scope, risk, Gherkin business scenarios, observable oracles, platform differences, visual sources, environment needs, and unresolved human decisions. Use before planning or implementation and whenever acceptance rejection requires a specification revision.
---

# Mobile Specification Author

Prepare the H1 artifact. Do not implement product code or record human approval.

## Establish intent

1. Read the active workflow, run state, relevant product context, and existing design or behavior.
2. Separate the user problem and business outcome from a proposed technical solution.
3. Mark in-scope, explicitly out-of-scope, dependencies, data sensitivity, and reversibility.
4. Escalate risk for authentication, payments, sensitive data, migrations, permissions, native dependencies, background behavior, OTA, or stores.
5. List required accounts, toolchains, devices, application identifiers, build profiles, isolated services, and human-only portal/legal actions without requesting secret values.
6. For confidential, restricted, or credential data, route to `mobile-data-protection` and include its proposed contract in the H1 pack.

## Define proof before implementation

- Give each requirement and scenario a stable ID.
- Write Gherkin in business language; keep selectors and device commands out of it.
- Assign UI, backend, OS, visual, security, or manual oracles as required.
- Define fixture ownership, reset behavior, platform coverage, and stop conditions.
- Bind visual requirements to an independent Figma node or repository reference plus normalization rules.
- Require asset provenance, license, performance constraints, and reduced-motion/accessibility fallbacks.
- Distinguish RLS, provider at-rest encryption, local secure storage, backend envelope encryption, and client E2EE; name trusted plaintext processors and recovery behavior.
- State which missing evidence forces `partially-verified` or `requires-human`.

Read [specification-checklist.md](references/specification-checklist.md) before presenting H1.

## Hand off

Return the stable specification-pack path, risk profile, requirement/scenario map, open prerequisites, and exact human decision requested. Ask the orchestrator to digest the entire pack and stop at `SPEC_PENDING`. Never imply approval from silence or from an agent-authored file.
