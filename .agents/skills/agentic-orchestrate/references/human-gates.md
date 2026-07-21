# Human gates

## Specification

Present the problem, scope, non-scope, business scenarios, design sources, platform differences, risk profile, and unresolved decisions. Ask for approval only when the specification artifact is stable. Record the digest before approval.

After H1, run environment preflight before planning. This is a machine readiness gate, not a substitute human approval. Record account/credential readiness without secret values and block on missing native targets or production isolation.

## Functional acceptance

Present implemented scope, Gherkin coverage, native replay results, backend effects, visual comparison, manual checks, deviations, and unresolved risk. Use `partially-verified` when any required evidence is absent.

## Final QA

Present the exact commit, build ID, native fingerprint, backend revision, store track, and evidence digest. Any code, configuration, migration, evidence, or binary change invalidates this approval and requires a new release candidate.

Human identity recorded in a file is an audit claim, not cryptographic proof. Obtain the decision through the product's actual human interaction surface; never call the approval command on the human's behalf.
