# React Native failure bundle

Collect only relevant artifacts and redact secrets.

```yaml
failureClass: UNKNOWN
platform: ios | android
buildProfile: development | e2e | preview | production
commit: <sha>
nativeFingerprint: <fingerprint>
appIdentifier: <bundle-or-package-id>
device: <model-and-os>
reproduction:
  preconditions: []
  steps: []
  expected: ""
  actual: ""
evidence:
  metro: null
  appLog: null
  runnerLog: null
  crash: null
  network: null
  snapshot: null
  screenshot: null
lastKnownGood: null
```

Prefer a stable error code, exception type, top stack frames, platform, and failing action when creating the failure signature. Do not include timestamps or random identifiers in the signature.
