---
name: react-native-debug
description: Reproduce, classify, and diagnose Expo and React Native runtime, Metro, Hermes, native module, config plugin, Xcode, Gradle, lifecycle, deep-link, performance, and device-only failures. Use when a native app crashes, hangs, renders incorrectly, works in Expo Go but not a development or release build, fails only on iOS or Android, or when an agent must distinguish product code from build, environment, device, fixture, or external-service failure before a fix.
---

# React Native Debugger

Diagnose before modifying. By default, return a root-cause report for the appropriate builder.

## Build a failure bundle

Read [failure-bundle.md](references/failure-bundle.md). Capture the failing platform, build profile, commit, native fingerprint, reproduction steps, exact output, relevant logs, and last known good state.

## Reproduce once

1. Verify whether the failure exists on the claimed artifact and platform.
2. Avoid retries until the first evidence bundle is preserved.
3. If reproduction fails because the environment is unhealthy, classify it accordingly and stop product-code changes.

## Localize the layer

Classify as one of:

- `PRODUCT_FAILURE`
- `TEST_FAILURE`
- `FIXTURE_FAILURE`
- `BUILD_FAILURE`
- `ENVIRONMENT_FAILURE`
- `DEVICE_FAILURE`
- `EXTERNAL_SERVICE_FAILURE`
- `UNKNOWN`

Inspect the narrowest relevant surface: Metro, Hermes, React DevTools, JS heap, native logs, Xcode/Gradle, Expo configuration, deep linking, network, backend, or Sentry. Use official version-matched documentation for installed packages.

For EAS failures, preserve the failing phase and build ID, compare with a known-good build, reproduce a release-mode build locally when possible, and check toolchain/environment parity before changing dependencies.

## Test hypotheses

- Keep at most three active hypotheses.
- Choose a diagnostic action that distinguishes between hypotheses.
- Record evidence that confirms or rejects each hypothesis.
- Stop after the same failure signature repeats twice or three hypotheses fail without new evidence.
- Do not weaken tests, clear unrelated state, rebuild blindly, or add defensive code before identifying the layer.

## Hand off the fix

Return failure classification, layer, root cause, confidence, evidence paths, recommended owner, minimal fix direction, and explicitly rejected fixes. The builder performs the change; an independent verifier reruns the original reproduction.
