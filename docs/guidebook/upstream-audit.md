# Upstream mobile workflow audit

Pinned source: `AIBiz-Automatyzacje/workspace-template-mobile` at the commit recorded in `upstream/workspace-template-mobile.lock.json`.

## Keep as concepts

- ideate, brainstorm, plan, execute, review, fix, compound;
- implementation units and severity gates;
- security, Supabase, Expo, EAS, accessibility, performance, and mobile UX knowledge;
- learned patterns and freshness audits;
- separate operator checklist.

## Rewrite

- Claude-specific Workflow and Agent APIs;
- autopilot state and loop control;
- device preflight and native evidence;
- E2E authoring, execution, and reporting;
- hooks that assume a root `tsconfig` or a single package;
- tool references hardcoded to one MCP function name.

## Remove or demote

- Maestro and `.maestro` deliverables;
- web-only React, Vite, shadcn, DOM, and CSS assumptions in mobile review;
- NativeWind v5 as a production default while upstream marks it pre-release;
- unverified statistics and rigid UI prescriptions;
- `npx ...@latest` in automatic hooks;
- rules that encourage tests or abstractions based on line counts rather than risk and behavior.

## Freshness contract

Each version-sensitive guidebook claim must eventually record platforms, applicable SDK range, stability, official source, verification date, and enforcement type. The audit reports stale content; it must not silently rewrite technical guidance.
