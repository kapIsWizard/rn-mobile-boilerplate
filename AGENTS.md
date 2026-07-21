# Mobilka agentic workflow

This repository builds an evidence-driven workflow for native Expo and React Native applications.

## Non-negotiable rules

1. Treat the installed native binary, backend environment, and device state as part of the product.
2. Do not claim success without durable evidence recorded in the active run.
3. Do not use Maestro. Use `agent-device` for all native E2E automation.
4. Do not let a builder approve its own implementation.
5. Stop automatic work when the circuit breaker opens or an iteration budget is exhausted.
6. Require human approval at specification, functional acceptance, and final release QA.
7. A changed specification, evidence bundle, or release artifact invalidates downstream approvals.
8. Classify a failure before changing product code. Environment failures are not product failures.
9. Never connect agent tooling or E2E fixtures to production data.
10. MCP is an interactive capability. CI must have a deterministic CLI or API fallback.
11. Do not plan implementation until a hashed environment manifest proves required toolchains, devices, isolated services, application IDs, and secret boundaries.
12. Never place server-only secrets, database passwords, management tokens, or signing material in app-readable environment variables, prompts, logs, screenshots, or evidence.
13. Never infer one platform, device class, build profile, or backend authorization result from another.
14. Manual operator verification must be bound to an exact build and stored as structured evidence.
15. Classify confidential, restricted, and credential data before H1 and bind a proposed data-protection contract into the specification digest.
16. Never invent cryptography, hardcode keys, reuse nonce/key pairs, record raw key material, or claim provider at-rest encryption/RLS as E2EE.
17. Agents may inspect cryptographic key metadata only. Production key operations, recovery, rotation, and export require their explicit gated workflow and human authority.

## Project skills

- `.agents/skills/agentic-orchestrate` — create and route a run through gates.
- `.agents/skills/mobile-specify` — prepare H1 scope, Gherkin, oracles, and design contracts.
- `.agents/skills/expo-react-native-build` — implement only the approved native scope.
- `.agents/skills/react-native-debug` — diagnose React Native, Expo, Metro, Hermes, and native build failures.
- `.agents/skills/agent-device-verify` — operate devices and collect native verification evidence.
- `.agents/skills/mobile-evidence-verify` — independently judge requirement and oracle coverage.
- `.agents/skills/mobile-change-review` — review changes without silently fixing them.
- `.agents/skills/mobile-docs-research` — resolve versioned guidance from official sources.
- `.agents/skills/mobile-data-protection` — choose protection patterns and define the key lifecycle and security evidence contract.
- `.agents/skills/native-release-operate` — build, distribute, and observe exact release candidates.
- `.agents/skills/agent-behavior-audit` — detect loops, invalid evidence, scope drift, and false success.

Read a matching `SKILL.md` before executing that responsibility.

## Commands

```bash
npm run agentic:validate
npm run agentic:test
npm run agentic:monitor
npm run agentic -- init --name example --risk standard
npm run agentic -- audit .agentic/runs/<run-id>
npm run agentic -- violation .agentic/runs/<run-id> --signal raw-key-material-recorded --role reviewer --evidence artifacts/redacted-finding.json
```

## Sources of truth

Use sources in this order: installed code and types, official vendor MCP, official documentation or changelog, then secondary documentation. Do not rely on model memory for versioned mobile APIs.
