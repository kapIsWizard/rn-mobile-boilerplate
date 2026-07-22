# Phase 1 brainstorming — prove the reusable auth boilerplate

Status: discussion draft before Phase 1 H1
Supersedes: private-notes-as-product direction

## First-principles objective

Phase 1 must prove that this repository is a real starting point for future native applications, not merely a successful demo run.

The product has two inseparable layers:

1. an Expo/React Native boilerplate with complete authentication and account lifecycle;
2. an agentic operating system that can specify, build, debug, verify, review, release, and monitor that native product with human H1/H2/H3 decisions.

The private-notes concept is no longer the Phase 1 product. At most, a tiny protected profile or later private-note feature can serve as a downstream `develop-feature` canary after auth is stable.

## Proposed Phase 1 sequence

### Phase 1A — deterministic auth core

- integrate the useful parts of the pinned upstream template into `apps/reference-mobile`;
- establish one workspace manager, lockfile, Expo baseline, identifiers, environments, and native build profiles;
- implement the application-owned auth/session contract and Supabase adapter;
- email/password registration, verification, returning login, and recovery;
- phone OTP registration/login using fixed non-production OTP fixtures;
- protected profile row and owner-only RLS;
- platform-protected session persistence, route guards, cold start, refresh, revocation, and logout;
- error taxonomy, offline/cancel/retry paths, visual states, accessibility, and plaintext sink checks;
- deterministic `agent-device` scenarios on pinned iOS and Android targets.

This stage proves the majority of product behavior without depending on Google/Apple portals or real SMS delivery.

### Phase 1B — native social-provider boundary

- Google authentication on installed iOS and Android builds;
- native Apple authentication on iOS;
- capability-gated Apple authentication on Android;
- provider-specific state/nonce, callback, cancellation, denial, duplicate callback, account collision, and token handling;
- real-provider canaries with synthetic accounts, redacted evidence, and `requires-human` where provider UI or credentials cannot be automated credibly;
- configuration preflight for Google Cloud, Apple Developer, Supabase, redirect URLs, capabilities, and provider branding.

This stage must not fake Google or Apple success through a mocked provider and call it E2E. Mocks prove our adapter behavior; a bounded real-provider canary proves the external boundary.

### Phase 1C — store-safe account lifecycle and template proof

- recent-auth confirmation and complete in-app account deletion;
- deletion/cascade of application data and Apple token revocation;
- external account-deletion URL contract for Google Play;
- privacy/terms/support configuration gates;
- release-like internal iOS and Android artifacts;
- clean downstream-project generation and rebranding;
- rerun the critical auth suite in the generated project;
- exercise H1, H2, dry-run H3, monitoring, debugger, behavior audit, and evidence binding end to end.

Only the completion of 1A–1C satisfies the repository goal. The stages control blast radius; they do not reduce the final scope.

## Recommended repository shape

```text
apps/
  reference-mobile/       runnable and releasable template application
packages/
  contracts/              only proven cross-boundary contracts
  test-fixtures/           deterministic non-secret auth/device fixtures
.agentic/                  state machine, policies, schemas, workflows, monitoring
docs/                      product goal, guidebook, requirements, decisions, evidence indexes
```

Auth should initially live as a cohesive feature in the reference app with an application-owned port around Supabase. Extract a package only after the clean-generation test proves the useful boundary. A generic auth framework created before one working implementation would increase abstraction without increasing reuse.

Use one package manager and one lockfile for the entire repository. The final choice follows inspection of the pinned upstream revision; do not combine unrelated root and app dependency graphs accidentally.

## Native verification ladder

1. Host checks: types, lint, unit, schema, callback/nonce/state and error contracts.
2. Local Supabase: email inbox, fixed phone OTP, migrations, profiles and RLS integration.
3. Installed development builds: deterministic email/phone/session scenarios through `agent-device` on one pinned iOS simulator and Android emulator.
4. Provider canaries: real Google on both platforms, Apple on iOS, Apple on Android when enabled, with synthetic accounts and human/provider boundary clearly recorded.
5. Release-like builds: cold start, deep links, lifecycle, secure storage, permissions, account deletion, provider capability fingerprints.
6. Physical-device/manual pass: autofill, native account sheets, biometrics where used, screen reader, keyboard, and final H2/H3 QA.
7. Generated-project self-test: repeat the critical suite after new identifiers and isolated backend configuration.

Expo Go, a web rendering, one platform, a mocked provider, or a UI-only assertion never proves the native cross-platform boundary.

## Backend and fixture topology

- local Supabase for migrations, RLS, local inbox, deterministic email callbacks, and fixed phone test OTP;
- isolated hosted E2E for installed builds, real provider callbacks, and release-like canaries;
- identical committed migrations and auth-relevant configuration contracts;
- synthetic email, phone, Google, and Apple identities owned outside the agent;
- unique per-run namespaces and idempotent reset where the provider permits it;
- no production access and no service-role, SMS, OAuth, Apple, or user credential in the app or evidence.

Real SMS is a bounded infrastructure canary, not a CI dependency. Provider UIs and anti-abuse systems are external behavior; retries have budgets and provider failures receive their own classification.

## Identity and account rules

- All methods converge on one normalized application session, but not every identifier is silently merged into one account.
- Verified provider identities may follow Supabase's approved automatic-linking behavior.
- Phone-only, Apple private-relay, unrelated, or ambiguous identities remain separate unless a later explicit linking flow requires recent authentication.
- Manual identity linking remains out of the base milestone until its beta/status and takeover threat model are accepted.
- The application never infers authorization from a provider email; backend RLS remains authoritative.

## Agent roles and loop prevention

- Specifier freezes provider/platform matrix, Gherkin, oracles, account collision/deletion policy, visual source, and human-only setup.
- Builder implements only after H1.
- React Native debugger classifies provider, callback, native capability, build, device, backend, or product failures before a fix.
- `agent-device` operator collects native evidence but does not judge acceptance.
- Independent verifier maps UI, backend, OS, storage, provider, and manual evidence to each scenario without editing code.
- Reviewer inspects auth threats, identity linking, secrets, RLS, lifecycle, platform configuration, tests, and release impact.
- Release operator handles exact artifacts only after H2/H3.
- Behavior auditor detects loops, false provider success, scope drift, test weakening, credential access, and baseline manipulation.

Two occurrences of the same stable failure signature open the circuit breaker. A provider outage does not authorize mocking the provider and relabeling the result as E2E. A failed real-provider canary remains `requires-human`, `partially-verified`, or `failed` according to evidence.

## Decisions required before Phase 1 H1

1. Confirm Supabase as the shipped default backend with an application-owned auth seam.
2. Confirm email means password + verification + recovery; decide whether magic links are additionally required.
3. Select the SMS provider, target countries, test numbers, rate/spend limits, and real-SMS canary policy.
4. Decide whether Apple on Android is enabled by default or shipped off by default as proposed.
5. Provide ownership metadata—not secrets—for Apple Developer, Google Cloud, Supabase, EAS, domains, privacy/support and provider test accounts.
6. Select product naming/bundle-ID base and redirect/universal-link domain strategy.
7. Approve the repository layout and one-workspace lockfile.
8. Select primary simulators/emulators, physical devices, and native/provider-canary operator.
9. Approve internal artifact versus TestFlight/Play Internal scope for Phase 1C.
10. Set EAS, macOS, SMS, and device-farm budgets plus attempt limits.

## Phase 1 entry criteria

- Phase 0 hardening has H2 evidence and the enforced human-approval path is active.
- The existing private-notes Phase 1 digest is treated as obsolete and is never approved.
- The auth-foundation pack is completed, digested as a new Phase 1 revision, and explicitly approved at H1.
- Exact versions are researched from official sources and committed to the lockfile.
- The pinned upstream integration decision is recorded before scaffolding.
- `agent-device`, iOS, Android, Supabase, EAS, identifiers, redirects, fixtures, and credential metadata pass truthful preflight.

## Phase 1 exit

The phase exits when email, phone, Google, Apple, session lifecycle, RLS, logout, recovery, deletion, security sinks, platform UX, and template regeneration meet the product acceptance criteria; deterministic scenarios pass repeatedly on both platforms; real-provider evidence is complete; and H1/H2/H3 operate without bypasses.

After that, a small private-notes feature is valuable as the first proof that a generated project can use the established `develop-feature` flow. It is no longer allowed to substitute for the boilerplate itself.

