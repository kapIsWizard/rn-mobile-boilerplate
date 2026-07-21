# Release manifest

Record at minimum:

- run ID, revision, risk, commit, clean/dirty status, and dependency-lock digest;
- specification and evidence digests;
- Expo/RN versions, native fingerprint, runtime/update channel, and generated native diff status;
- backend project/environment and migration revision;
- data-protection profile, ciphertext format version, non-secret key IDs/versions, rotation or migration status, recovery/rollback owner, and store encryption/export declarations;
- iOS bundle ID, Android application ID, build profile, build numbers, and signing owner;
- EAS/platform build IDs, artifact URLs, local artifact hashes, and distribution tracks;
- native replay results and final manual-device matrix;
- H3 approval identity, time, and matching release-artifact digest;
- rollout plan, canaries, monitoring window, stop thresholds, rollback owner, and rollback instructions.

Secrets, signing material, customer data, and expiring credential-bearing URLs must not be committed.
