# GitHub human gates — operator runbook

This runbook configures the external H1/H2/H3 trust boundary. Local `approve --by` text is not identity evidence; it remains available only for the single Phase 0 bootstrap H1 listed in `.agentic/approval-providers.json`.

## 1. Create a separate agent identity

Create and install a dedicated GitHub App on `kapIsWizard/rn-mobile-boilerplate`. Do not give the app the human SSH key, a personal access token, environment administration, secret administration, or organization administration.

Repository permissions:

- Metadata: read (mandatory GitHub baseline);
- Actions: read and write, for trusted workflow dispatch and independent run/review lookup;
- Contents: read and write, only if this app will create implementation branches and commits;
- Pull requests: read and write, only if this app will open or update PRs;
- Workflows: no access after bootstrap, so the agent cannot rewrite its own gate workflow.

Record the immutable app bot login and ID in `github.agentIdentity` inside `.agentic/approval-providers.json`. Installation tokens must be short-lived and supplied only as `GITHUB_APP_INSTALLATION_TOKEN`; never write them to `.env`, run state, logs, fixtures, screenshots, or evidence.

## 2. Protect the trust root on `main`

Configure a branch ruleset for `main`:

- require a pull request and the CODEOWNERS review by `kapIsWizard`;
- require the `Agentic foundation / verify` check;
- dismiss stale approvals when protected files change;
- require conversation resolution;
- block force pushes and branch deletion;
- apply the rule to administrators and do not grant the agent app a bypass;
- protect `.github/`, `.agentic/`, `scripts/agentic/`, `package*.json`, policy, schema, environment, security, and requirements paths via `.github/CODEOWNERS`.

The trusted `.github/workflows/human-gate.yml` must exist on `main`. Approval requests are always dispatched with `ref=main`; the adapter rejects a different workflow path, branch, repository ID, app actor, or run title.

## 3. Configure protected environments

Create exactly these repository environments:

- `h1-specification`
- `h2-acceptance`
- `h3-release`

For each environment:

1. add `kapIsWizard` as required reviewer;
2. enable **Prevent self-review**;
3. disable **Allow administrators to bypass configured protection rules**;
4. restrict deployment branches/tags to `main` only;
5. add no environment secrets—the gate workflow does not need any.

Confirm that the human reviewer has immutable user ID `96981818`. If GitHub reports a different ID, stop and update the approved trust decision before running a canary.

## 4. Enable the provider

During the Phase 0 bootstrap canary, set `github.enabled` to `true` and fill the App login/ID. Keep manual approval constrained to the already allowlisted Phase 0 specification gate. After H2 accepts the canary evidence, change the provider configuration to:

```json
{
  "mode": "enforced",
  "manual": {
    "enabled": false,
    "allowedGates": [],
    "bootstrapRunIds": []
  }
}
```

Do not enable enforced mode until the app identity, environments, trusted workflow, branch rules, and token delivery are all proven.

## 5. Run the non-production canary

From the exact committed candidate checked out locally:

```sh
npm ci
npm run agentic:check
npm run agentic -- request-approval <run-dir> --gate acceptance --ttl-minutes 30
```

The last command returns the canonical request path and GitHub workflow-run ID. The human opens that run, compares the run ID, request UUID, request digest, candidate commit, artifact digests, expiry, and `h2-acceptance` environment, then approves in GitHub.

After the workflow completes successfully:

```sh
npm run agentic -- verify-approval <run-dir> --request <request-path> --workflow-run-id <id>
npm run agentic -- transition <run-dir> --to ACCEPTED
```

The verifier re-fetches the workflow run and review history before the transition. A provider outage, expiry, changed commit/digest/request, wrong branch/workflow/app, bot/self/outside reviewer, rejection, or previous consumption blocks without replacing the prior approval record.

## 6. Evidence checklist

Store only metadata and redacted screenshots:

- repository ID, commit SHA, workflow run ID/URL, request UUID/digest, gate and environment;
- reviewer login and immutable ID, app bot login and immutable ID;
- branch-rule and environment settings showing no bypass and self-review prevention;
- `npm ci`, `npm run agentic:check`, monitor, and behavior-audit results;
- negative test output for stale, replay, bot/self, manual H2/H3, and outage cases.

Never store installation tokens, private keys, environment secrets, signing credentials, raw authentication material, or production data.

## Stop conditions

Stop rather than weakening policy if the app and human identities are not distinct, the workflow is not running from `main`, the environment lacks required-review protection, admin bypass cannot be disabled, API evidence cannot be fetched consistently, or any negative test unexpectedly passes.
