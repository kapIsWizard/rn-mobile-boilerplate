# Oracle catalog

| Claim | Minimum useful oracle |
|---|---|
| Screen behavior | semantic native assertion on the installed artifact |
| Persistence | terminate/reopen replay plus durable-store or backend observation |
| Authorization | request as each identity plus deny result; UI hiding is insufficient |
| Local secret storage | platform storage inspection/config plus lock, reinstall, backup, and biometric behavior from the contract |
| Application encryption | test vectors, tamper/wrong-key/wrong-AAD rejection, nonce uniqueness, versioned envelope, and known-marker absence at storage boundary |
| Key lifecycle | metadata-only key versions plus rotation/rewrap, interrupted migration, revocation, recovery, and rollback drill |
| E2EE | ciphertext before upload plus proof that backend/service roles lack decryption material; provider at-rest encryption is insufficient |
| Idempotency | stable operation key plus backend uniqueness or exact row count |
| Deep link | OS-level open from terminated state plus correct content assertion |
| Offline recovery | controlled network state, preserved input, backend absence, then exact retry effect |
| Visual conformity | normalized current/reference/diff with required semantic elements |
| Native configuration | build metadata, installed identifier, fingerprint, and device behavior |
| Performance | named device/build/fixture, measured samples, threshold, and raw trace |
| Accessibility | automated semantics plus declared manual screen-reader checks where required |
