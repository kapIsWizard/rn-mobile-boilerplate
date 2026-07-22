# GitHub human gates — operator runbook

This runbook configures the external H1/H2/H3 trust boundary. Local `approve --by` text is not identity evidence; it remains available only for the single Phase 0 bootstrap H1 listed in `.agentic/approval-providers.json`.

## 0. Bind a clone to its repository

The schema and validation rules are reusable. The committed `.agentic/approval-providers.json` and `.github/CODEOWNERS` are generated deployment bindings and must be different for every downstream repository.

Give the operator a short-lived GitHub token that can read repository and user metadata through the process environment named by `--metadata-token-env`. Never write this token to `.env`, a prompt, logs, fixtures, screenshots, evidence, or committed configuration.

First inspect a dry-run plan. The repository defaults to the authenticated `origin` URL; `--repository` may be supplied only to assert the expected target.

```sh
npm run agentic -- bootstrap-trust \
  --reviewers reviewer-login[,second-reviewer] \
  --metadata-token-env GITHUB_TOKEN
```

The command resolves immutable repository and identity IDs from GitHub, rejects bots as human reviewers, rejects an agent/reviewer identity collision, validates the generated policy, and prints the files it would replace. It does not write by default.

After inspecting the plan, a human operator applies the binding:

```sh
npm run agentic -- bootstrap-trust \
  --reviewers reviewer-login[,second-reviewer] \
  --metadata-token-env GITHUB_TOKEN \
  --apply
```

Changing an existing binding in the same repository is an explicit trust-root rotation and additionally requires `--rebind`. Applying either file without the other is forbidden: the command validates and replaces the policy and CODEOWNERS as one transaction, restoring the previous pair if replacement fails.

The generated policy deliberately remains in `bootstrap` mode with GitHub approvals disabled, manual approvals restricted to H1, and no inherited bootstrap run IDs. Commit the generated pair, protect it on the default branch, configure the controls below, and only then enable the external provider. A clean clone whose `origin`, immutable repository ID, policy, or CODEOWNERS disagree fails `npm run agentic:validate` before any approval request is sent.

## 1. Create a separate agent identity

Create and install a dedicated GitHub App on the repository recorded in `github.repository`. Do not give the app the human SSH key, a personal access token, environment administration, secret administration, or organization administration.

Repository permissions:

- Metadata: read (mandatory GitHub baseline);
- Actions: read and write, for trusted workflow dispatch and independent run/review lookup;
- Contents: read and write, only if this app will create implementation branches and commits;
- Pull requests: read and write, only if this app will open or update PRs;
- Workflows: no access after bootstrap, so the agent cannot rewrite its own gate workflow.

After GitHub exposes the App bot account, resolve and bind it through the same controlled command instead of editing IDs by hand:

```sh
npm run agentic -- bootstrap-trust \
  --reviewers reviewer-login[,second-reviewer] \
  --agent delivery-app[bot] \
  --metadata-token-env GITHUB_TOKEN \
  --rebind \
  --apply
```

Installation tokens must be short-lived and supplied only as `GITHUB_APP_INSTALLATION_TOKEN`; never write them to `.env`, run state, logs, fixtures, screenshots, or evidence.

## 2. Protect the trust root on `main`

Configure a branch ruleset for `main`:

- require a pull request and review by the humans generated into `.github/CODEOWNERS`;
- require the `Agentic foundation / verify` check;
- dismiss stale approvals when protected files change;
- require conversation resolution;
- block force pushes and branch deletion;
- apply the rule to administrators and do not grant the agent app a bypass;
- protect `.github/`, `.agentic/`, `scripts/agentic/`, `package*.json`, policy, schema, environment, security, and requirements paths via `.github/CODEOWNERS`.

The trusted `.github/workflows/human-gate.yml` must exist on `main`. Approval requests are always dispatched with `ref=main`; the adapter rejects a different workflow path, branch, repository ID, app actor, or run title.

## 3. Configure protected environments

Create the environments recorded in `github.environments`. The default binding generates:

- `h1-specification`
- `h2-acceptance`
- `h3-release`

For each environment:

1. add the human reviewers recorded in `github.reviewers` as required reviewers;
2. enable **Prevent self-review**;
3. disable **Allow administrators to bypass configured protection rules**;
4. restrict deployment branches/tags to `main` only;
5. add no environment secrets—the gate workflow does not need any.

Confirm that every reviewer login, immutable user ID, repository name, repository ID, and app identity matches the generated policy. Any mismatch requires a reviewed trust-root rotation; do not edit an ID by hand just to make a canary pass.

## 4. Enable the provider

During the repository bootstrap canary, set `github.enabled` to `true` and verify the App login/ID resolved during bootstrap. A migration may keep manual approval constrained to an explicitly reviewed bootstrap specification run; a fresh downstream repository starts without inherited run IDs. After H2 accepts the canary evidence, change the provider configuration to:

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

- repository ID, trust-policy digest, commit SHA, workflow run ID/URL, request UUID/digest, gate and environment;
- reviewer login and immutable ID, app bot login and immutable ID;
- branch-rule and environment settings showing no bypass and self-review prevention;
- `npm ci`, `npm run agentic:check`, monitor, and behavior-audit results;
- negative test output for stale, replay, bot/self, manual H2/H3, and outage cases.

Never store installation tokens, private keys, environment secrets, signing credentials, raw authentication material, or production data.

## Stop conditions

Stop rather than weakening policy if the repository identity disagrees with `origin`, policy and CODEOWNERS disagree, a downstream clone inherited owners or bootstrap run IDs, app and human identities are not distinct, the workflow is not running from `main`, the environment lacks required-review protection, admin bypass cannot be disabled, API evidence cannot be fetched consistently, or any negative test unexpectedly passes.
