# Device evidence bundle

Store evidence under the active run or the configured artifact directory.

```yaml
scenarioId: SCN-EXAMPLE-001
platform: ios
device: iPhone Simulator
osVersion: ""
appIdentifier: ""
buildId: ""
commit: ""
nativeFingerprint: ""
fixture: ""
replay: e2e/agent-device/example.ad
attempts: 1
result: verified
checks:
  ui: passed
  backend: not-required
  visual: not-required
artifacts:
  snapshot: ""
  screenshot: ""
  diff: null
  recording: null
  appLog: null
failure:
  class: null
  signature: null
manual: []
```

Never store passwords, tokens, service-role keys, raw production data, or unsanitized customer screenshots. A skipped required check produces `partially-verified` or `not-verified`, never `verified`.
