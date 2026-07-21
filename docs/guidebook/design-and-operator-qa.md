# Design system, assets, and operator QA

## Design contract

Use both:

- a machine-readable token/behavior contract for color, typography, spacing, shape, elevation, motion, states, accessibility, and platform divergence;
- an independent visual source such as a versioned Figma node or repository SVG/PNG export.

A generated HTML preview is useful for human review but is not the native reference and cannot prove safe areas, native fonts, keyboard, back behavior, status bars, or platform controls.

## Just-in-time assets

Prepare only assets needed by the next approved vertical slice. Each asset records source, generator/model or author, prompt/reference provenance when relevant, license, human approval, target sizes/formats, compression, dark/light behavior, reduced-motion fallback, and accessibility alternative.

Inspiration sources are not automatically licensed implementation assets. Do not reproduce third-party screens or brand systems without review.

## Launch experience

The native splash is a static platform launch surface shown only until application content is ready. Test it on an internal/release build. If the product needs a branded animation, render it as the first in-app screen after the native splash, avoid an artificial fixed delay, cap its performance cost, make it interruptible after initialization, and provide reduced-motion behavior.

## Operator checklist

Manual work is evidence, not a conversation memory. Every step includes requirement/scenario ID, exact build ID, platform, OS, device type, starting state, action, expected result, observed result, artifact, performer, and timestamp.

Use physical devices only for claims that require them: biometrics, hardware-backed credentials, production-like push, camera/sensors, store-distributed artifacts, real performance/thermal behavior, or provider behavior unavailable on simulators. Simulator/emulator proof remains valid for its declared scope.

## No cross-platform inference

- iOS pass does not pass Android.
- Android emulator does not pass a physical Android device.
- development build does not pass internal/store release.
- visual similarity does not pass behavior.
- UI hiding does not pass authorization.
- manual tapping does not replace a replayable critical business scenario.

When a required target is unavailable, report `blocked-by-environment` or `requires-human`; never downgrade it silently.
