# Audit of the supplied mobile-course materials

Verified: 2026-07-22

## Material map

| Material | Main subject | Durable value |
|---|---|---|
| M1 | Apple/Google login builds and manual iPhone verification | operator handoff, physical-device checks, backend observation, build-log debugging |
| M2 | auth/onboarding preparation and phased implementation | explicit preparation, Figma inputs, plan/docs/execute separation, progress notes |
| M3 | branch workflow, long-running autopilot, EAS builds, Sentry and external review | isolated branches, preflight, native builds, observability canary, independent review |
| M4 | accounts, identifiers, Expo/EAS, Supabase and Sentry prerequisites | environment inventory before coding and business-friendly operator guidance |
| M5 | `design.md`, design preview, Figma and just-in-time assets | durable design language, asset readiness per slice, human visual selection |
| M6 | PRD decomposition and adversarial plan review | vertical slices, dependency-aware sequencing, explicit product edge cases, human challenge role |

The transcripts are experience reports, not versioned technical documentation. Every API, CLI, credential, store, OAuth, or SDK instruction must be checked against installed versions and official sources before enforcement.

## Adopt

1. Start from a product source of truth, then decompose it into dependent vertical slices that each run on a phone.
2. Prepare only the design and asset inputs needed by the next approved slice.
3. Separate specification, implementation plan, executable tasks, implementation, verification, review, and human acceptance.
4. Ask the operator for missing accounts, permissions, design decisions, devices, and store actions in plain business language.
5. Use development builds early; use internal/release-like builds for native launch screen and final QA.
6. Keep design tokens plus usage intent in a versioned repository contract and bind Figma/exported references to acceptance.
7. Exercise observability with a deliberate canary and verify symbolication/source maps, then remove or disable the test hook outside non-production builds.
8. Use an independent reviewer as another source of findings, not as an acceptance authority.
9. Preserve EAS/native build logs and compare with a known-good build before changing dependencies.
10. Update milestone history and implementation notes after a human-approved merge.

## Strengthen

- A manual operator pass becomes a structured checklist with build ID, platform, device, expected result, evidence, identity, and timestamp.
- A portal click becomes configuration evidence or an infrastructure-as-code change; undocumented dashboard state is drift.
- Native OAuth requires a platform/build/signing matrix, not one generic client ID.
- Visual review requires current/reference/diff plus semantic checks; “looks okay” is not evidence.
- Cross-platform React Native code still requires platform-specific verification. An iOS pass says nothing conclusive about Android.
- Automatic work is time-, retry-, and evidence-bounded. A two-hour agent run is not healthy merely because it eventually exits zero.
- Development, E2E, preview, and production projects/identifiers/data are separated before the first test data, not cleaned up just before launch.
- Figma, generated images, fonts, video, and inspiration assets need provenance, license, export settings, performance budget, and accessibility alternatives.

## Reject as unsafe or false

1. Never place Supabase secret/service-role keys, database passwords, signing material, or non-expiring management tokens in an app-readable `.env`, agent prompt, screenshot, or committed file.
2. A keystore is not an application's unique identifier. The Android application ID identifies the app; a keystore contains private signing keys. SHA fingerprints identify the public signing certificate and are not “encryption”.
3. Never infer Android success from iOS success, simulator success from a physical device, development-build behavior from a release build, or UI visibility from backend authorization.
4. Never postpone all E2E “for later” after accepting a feature. Risk-selected `agent-device` scenarios are part of completion.
5. Never treat an external AI review, a green build, a successful upload, or an agent's own test report as human acceptance.
6. Never keep an intentional crash/test button reachable in production.
7. Never force a fixed multi-second launch delay. The native splash exists only until content is ready; branded animation belongs after the native launch screen and must respect performance and reduced-motion policy.
8. Never give an interactive MCP broad production access because it is convenient. Use project-scoped least privilege and deterministic migration/configuration files.

## Current official-source corrections

| Question | Current conclusion | Enforcement |
|---|---|---|
| Expo Go versus development builds | Expo describes Expo Go as a limited playground and development builds as the production-grade development environment. | development/internal builds required by policy |
| Splash verification | Expo says development builds do not fully reproduce standalone splash behavior; verify on internal or production builds. | release-like artifact evidence |
| EAS variable visibility | Plain, sensitive, and secret have different availability. `EXPO_PUBLIC_` values are client-visible; secret variables cannot be pulled or used for client JS bundling. | secret inventory and build-profile checks |
| Supabase client key | Current mobile guidance uses the project URL plus publishable key. Secret/service-role keys bypass RLS and are backend-only. | block transition on secret-boundary violation |
| Android signing and OAuth | The application ID/package name and signing-certificate fingerprint are separate inputs. OAuth clients must match the distribution signing certificate. | environment manifest records IDs and evidence, never private keys |
| agent-device | The official CLI supports semantic snapshots, logs, recordings, network evidence, environment controls, and replayable `.ad` workflows. | only native E2E driver |

## Primary references

- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo splash screen and app icon](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/)
- [Expo EAS environment variables](https://docs.expo.dev/eas/environment-variables/manage/)
- [Expo app credentials](https://docs.expo.dev/app-signing/app-credentials/)
- [Expo EAS build troubleshooting](https://docs.expo.dev/build-reference/troubleshooting/)
- [Expo Sentry integration](https://docs.expo.dev/guides/using-sentry/)
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase data security](https://supabase.com/docs/guides/database/secure-data)
- [Supabase Auth with React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [Android app authorization identity](https://developer.android.com/identity/authorization)
- [Apple Sign in with Apple capability](https://developer.apple.com/help/account/capabilities/about-sign-in-with-apple/)
- [agent-device](https://agent-device.dev/)
