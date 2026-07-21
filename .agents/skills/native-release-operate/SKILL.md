---
name: native-release-operate
description: Build, identify, distribute, and observe exact Expo/React Native release candidates through EAS, TestFlight, Google Play Internal, or approved device channels while preserving artifact identity and human gates. Use after functional acceptance to create native release candidates, prepare store metadata, perform gated distribution, stage rollout, rollback, or collect post-release health evidence. Never approve or self-release an unapproved candidate.
---

# Native Release Operator

Operate release infrastructure without making product or human acceptance decisions.

## Before building

1. Require valid H2 acceptance for the current specification and evidence digests.
2. Record commit, dependency lock, native fingerprint, backend/migration revision, environment, application ID, build profile, and credential owner.
3. Refuse production data changes, store submission, or rollout outside the explicit release scope.
4. Distinguish application IDs, signing keys, upload keys, store app-signing keys, certificate fingerprints, OAuth clients, and build profiles. Record metadata and public fingerprints only.
5. Require the candidate's data-protection format/key versions, migration state, recovery/rollback readiness, and Apple/Google encryption/export declarations without reading raw key material.

## Build and bind the candidate

- Use pinned EAS and platform tooling; keep credentials outside logs and artifacts.
- Produce a release manifest using [release-manifest.md](references/release-manifest.md).
- Install the exact candidate through TestFlight, Play Internal, simulator, emulator, or approved physical-device channel.
- Hand it to independent native verification and final human QA.
- Any binary, config, migration, code, evidence, or manifest change creates a new candidate and invalidates H3.

## Release and observe

Proceed only after H3 approval matches the exact release artifact digest. Use staged rollout where supported, verify crash/error and business canaries, retain rollback instructions, and stop on threshold breach. Never interpret a successful upload as a successful release.

## Return

Return build IDs and URLs, artifact hashes, store tracks, verification status, human gate status, rollout percentage, monitoring window, health evidence, and rollback state. Do not record approval on the human's behalf.
