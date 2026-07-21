---
name: agent-device-verify
description: Operate iOS and Android simulators, emulators, physical devices, and device farms with agent-device; author and replay deterministic .ad scenarios; assert native UI behavior; collect logs, screenshots, recordings, performance evidence, and visual diffs. Use for native E2E verification, reproducing mobile failures, validating Gherkin business scenarios on an installed build, comparing implementation with Figma, or producing a device evidence bundle. Do not use Maestro.
---

# Agent Device Verifier

Use `agent-device` as the only native E2E driver. Keep device operation separate from business acceptance.

## Load the installed contract

1. Run `agent-device --version`.
2. Read `agent-device help workflow` and `agent-device help react-native` before planning commands.
3. Read `agent-device help debugging` for runtime evidence and `agent-device help dogfood` for exploratory QA.
4. Do not silently use `npx ...@latest` when the installed CLI is absent. Return `ENVIRONMENT_FAILURE` with setup instructions.

## Preflight

Verify the exact build, app identifier, platform, device, backend environment, fixture version, Metro requirement, and available storage. Run a canary open and snapshot before the suite.

Do not infer Android from iOS, physical devices from simulators, or release behavior from development builds. Report every target independently.

## Execute safely

- Use `open -> snapshot -i -> act -> re-snapshot -> assert -> close`.
- Serialize mutating operations within one session.
- Use refs for exploration and semantic selectors for durable replay.
- Record stable business flows as `.ad` files.
- Use `agent-device test` for suites and treat passed-on-retry as flaky.
- Do not change application code, Gherkin, assertions, or visual baselines.
- Execute human-only checks from the build-bound operator checklist and preserve performer/time evidence; do not translate verbal confirmation into a pass.
- Stop after a repeated failure signature or an exhausted environment budget.

## Collect evidence

Read [evidence-bundle.md](references/evidence-bundle.md). Capture the smallest evidence set that proves or disproves the scenario. Redact credentials and personal data. Do not commit raw device artifacts by default.

## Visual verification

Normalize device, orientation, locale, appearance, font scale, fixtures, motion, and status bar. Capture the current image, create a screenshot diff, and report changed regions. Do not treat a global pixel difference as a business failure without semantic review. Never update a baseline without human approval.

## Return

Return `verified`, `partially-verified`, `not-verified`, `blocked-by-environment`, or `requires-human`. Include scenario IDs, platform, artifact paths, failure classification, flaky status, and manual checks.
