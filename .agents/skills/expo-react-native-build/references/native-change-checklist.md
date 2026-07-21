# Native change checklist

- Decide whether the change needs JS reload, development build, native rebuild, or store binary.
- Check iOS and Android application IDs, schemes, deep links, entitlements, permissions, and configuration plugins.
- Check safe areas, keyboard behavior, native back, lifecycle, cold start, locale, font scale, appearance, and accessibility.
- Keep secrets out of bundles, logs, screenshots, and committed fixtures.
- Check SecureStore/Keychain/Keystore accessibility, Android backup exclusions, iOS reinstall behavior, biometric invalidation, and real-device requirements against the approved contract.
- For application encryption, check AEAD library/version, unique nonce strategy, AAD, DEK/KEK separation, envelope version, recovery, rotation, rollback, and plaintext cleanup.
- Pin dependencies and record native fingerprint changes.
- Keep migrations reversible where practical and RLS deny-by-default.
- Use deterministic test identities, clocks, network conditions, and resets.
- Report every skipped or unavailable platform check; never translate it into a pass.
