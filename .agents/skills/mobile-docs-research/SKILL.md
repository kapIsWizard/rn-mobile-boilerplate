---
name: mobile-docs-research
description: Resolve version-sensitive Expo, React Native, agent-device, Supabase, EAS, Apple, Android, Sentry, cryptography, secure storage, KMS, or library questions using installed code first and official MCP or documentation sources with a durable freshness record. Use before choosing package versions, native APIs, config plugins, permissions, build settings, crypto libraries, key APIs, CI commands, migrations, or guidebook advice and whenever remembered guidance may be stale.
---

# Mobile Documentation Researcher

Research and record; do not mutate product code, infrastructure, credentials, or production data.

## Resolve the installed context

1. Read package manifests, lockfiles, native files, CLI versions, and local help.
2. Identify the exact SDK/library/platform version and the decision being made.
3. Route through `.agentic/capabilities.json`; prefer official version-matched MCP, then official documentation or changelog, then source and types.
4. Use secondary sources only to locate primary material, not as the final authority for technical behavior.
5. Treat tutorials, course transcripts, generated guidebooks, and remembered CLI flows as secondary experience reports; extract patterns but verify every versioned command, portal field, credential rule, and store requirement.
6. For cryptography, verify the platform API, algorithm/mode, library version and maintenance, nonce/AAD contract, key storage, backup/reinstall behavior, hardware claims, migration, and export-compliance impact. Never infer FIPS validation or hardware backing from an API name.

Read [documentation-routing.md](references/documentation-routing.md). Interactive MCP names are capabilities, not hardcoded guarantees; CI must use pinned CLI or API fallbacks.

## Return a freshness record

Include question, installed versions, conclusion, official source links or MCP resources, applicable platform/SDK range, stability, verification date, contradictions, confidence, and enforcement recommendation. Mark unknowns explicitly. Never convert unverified guidebook advice into a mandatory rule.
