import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  approveRun,
  initRun,
  loadKernel,
  readRun,
  setRunDigest
} from './lib.mjs';
import {
  calculateRequestDigest,
  consumeApprovalRequest,
  createApprovalRequest,
  requestGithubApproval,
  verifyGithubApproval
} from './approvals.mjs';

async function approvalFixture(gate = 'specification') {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'mobilka-approval-'));
  const kernel = await loadKernel();
  kernel.config = {
    ...kernel.config,
    runRoot: path.join(temporary, 'runs'),
    telemetryRoot: path.join(temporary, 'telemetry')
  };
  kernel.approvalProviders.github.enabled = true;
  kernel.approvalProviders.github.agentIdentity = {
    kind: 'GitHubApp',
    login: 'mobilka-agent[bot]',
    id: 4242
  };
  const { runDir } = await initRun(kernel, { name: `approval ${gate}`, risk: 'critical' });
  const artifacts = path.join(temporary, 'artifacts');
  await mkdir(artifacts, { recursive: true });
  const spec = path.join(artifacts, 'spec.md');
  await writeFile(spec, '# Exact approved specification\n');
  await setRunDigest(kernel, runDir, 'spec', spec);
  if (gate !== 'specification') {
    const environment = path.join(artifacts, 'environment.json');
    const evidence = path.join(artifacts, 'evidence.json');
    await writeFile(environment, '{"environment":"test"}\n');
    await writeFile(evidence, '{"evidence":"verified"}\n');
    await setRunDigest(kernel, runDir, 'environment', environment);
    await setRunDigest(kernel, runDir, 'evidence', evidence);
  }
  if (gate === 'release') {
    const releaseArtifact = path.join(artifacts, 'release.json');
    await writeFile(releaseArtifact, '{"build":"rc-1"}\n');
    await setRunDigest(kernel, runDir, 'releaseArtifact', releaseArtifact);
  }
  const commitSha = 'a'.repeat(40);
  const now = Date.now();
  const request = createApprovalRequest(kernel, await readRun(runDir), { gate, commitSha, now });
  const requestPath = path.join(runDir, 'approval-requests', `${gate}-${request.requestId}.json`);
  await mkdir(path.dirname(requestPath), { recursive: true });
  await writeFile(requestPath, `${JSON.stringify(request, null, 2)}\n`);
  return { temporary, kernel, runDir, request, requestPath, commitSha, now };
}

function githubEvidence(kernel, request, overrides = {}) {
  const github = kernel.approvalProviders.github;
  const workflowRunId = overrides.workflowRunId || 9001;
  const actor = overrides.actor || { login: github.agentIdentity.login, id: github.agentIdentity.id, type: 'Bot' };
  const reviewer = overrides.reviewer || github.reviewers[0];
  const run = {
    id: workflowRunId,
    repository: { id: github.repositoryId, full_name: github.repository },
    event: 'workflow_dispatch',
    path: `.github/workflows/${github.workflowFile}`,
    head_branch: github.trustedRef.replace('refs/heads/', ''),
    display_title: `human-gate:${request.gate}:${request.requestId}:${request.requestDigest}`,
    status: 'completed',
    conclusion: 'success',
    actor,
    triggering_actor: actor,
    updated_at: new Date(Date.parse(request.createdAt) + 1_000).toISOString(),
    html_url: `https://github.com/${github.repository}/actions/runs/${workflowRunId}`,
    ...overrides.run
  };
  const reviews = overrides.reviews || [{
    state: 'approved',
    environments: [{ name: request.environment }],
    user: reviewer
  }];
  const fetchImpl = overrides.fetchImpl || (async (url) => ({
    ok: true,
    status: 200,
    json: async () => {
      if (String(url).includes('/contents/.agentic/approval-providers.json')) {
        return {
          path: '.agentic/approval-providers.json',
          encoding: 'base64',
          content: Buffer.from(JSON.stringify(kernel.approvalProviders)).toString('base64')
        };
      }
      return String(url).endsWith('/approvals') ? reviews : run;
    }
  }));
  return { workflowRunId, fetchImpl, run, reviews };
}

async function verifyFixture(fixture, overrides = {}) {
  const evidence = githubEvidence(fixture.kernel, fixture.request, overrides);
  return verifyGithubApproval(fixture.kernel, fixture.runDir, {
    requestPath: fixture.requestPath,
    workflowRunId: evidence.workflowRunId,
    fetchImpl: evidence.fetchImpl,
    token: 'installation-token-for-test',
    currentCommitSha: fixture.commitSha,
    now: fixture.now + 2_000,
    persist: overrides.persist ?? true
  });
}

test('exact protected-environment evidence persists bound provenance without credentials', async () => {
  const fixture = await approvalFixture();
  const approval = await verifyFixture(fixture);
  assert.equal(approval.source, 'github-environment');
  assert.equal(approval.requestDigest, fixture.request.requestDigest);
  assert.equal(approval.approvedById, 96981818);
  assert.equal(JSON.stringify(approval).includes('installation-token-for-test'), false);
  assert.equal((await readRun(fixture.runDir)).approvals.specification.requestId, fixture.request.requestId);
});

test('approval dispatch runs only from the trusted ref and carries the canonical request digest', async () => {
  const fixture = await approvalFixture();
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/contents/.agentic/approval-providers.json')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          path: '.agentic/approval-providers.json',
          encoding: 'base64',
          content: Buffer.from(JSON.stringify(fixture.kernel.approvalProviders)).toString('base64')
        })
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ workflow_run_id: 12345, html_url: 'https://github.com/example/actions/runs/12345' })
    };
  };
  const result = await requestGithubApproval(fixture.kernel, fixture.runDir, {
    gate: 'specification',
    fetchImpl,
    token: 'test',
    commitSha: fixture.commitSha,
    now: fixture.now
  });
  const dispatch = calls.find((call) => call.url.endsWith('/actions/workflows/human-gate.yml/dispatches'));
  const body = JSON.parse(dispatch.options.body);
  assert.equal(body.ref, 'main');
  assert.equal(body.inputs.request_id, result.request.requestId);
  assert.equal(body.inputs.request_digest, result.request.requestDigest);
  assert.equal(body.inputs.digest_snapshot, JSON.stringify(result.request.digestSnapshot));
  assert.equal(result.workflowRunId, 12345);
});

test('mutating any approval-bound request field fails before approval state changes', async () => {
  const mutations = [
    ['repository', (request) => { request.repository = 'attacker/other'; }],
    ['run', (request) => { request.runId = 'other-run'; }],
    ['gate', (request) => { request.gate = 'release'; request.environment = 'h3-release'; }],
    ['revision', (request) => { request.revision += 1; }],
    ['digest', (request) => { request.digestSnapshot.spec = 'b'.repeat(64); }],
    ['commit', (request) => { request.commitSha = 'b'.repeat(40); }],
    ['request ID', (request) => { request.requestId = '11111111-1111-4111-8111-111111111111'; }]
  ];
  for (const [label, mutate] of mutations) {
    const fixture = await approvalFixture();
    const approvedDisplayTitle = `human-gate:${fixture.request.gate}:${fixture.request.requestId}:${fixture.request.requestDigest}`;
    mutate(fixture.request);
    fixture.request.requestDigest = calculateRequestDigest(fixture.request);
    await writeFile(fixture.requestPath, `${JSON.stringify(fixture.request, null, 2)}\n`);
    await assert.rejects(() => verifyFixture(fixture, { persist: false, run: { display_title: approvedDisplayTitle } }), /mismatch|missing artifact digests/,
      `${label} mutation must fail closed`);
    assert.equal((await readRun(fixture.runDir)).approvals.specification, null);
  }
});

test('a consumed request cannot be replayed', async () => {
  const fixture = await approvalFixture();
  const approval = await verifyFixture(fixture);
  await consumeApprovalRequest(fixture.kernel, fixture.runDir, approval, 'SPEC_PENDING->SPEC_APPROVED', fixture.now + 3_000);
  await assert.rejects(
    () => consumeApprovalRequest(fixture.kernel, fixture.runDir, approval, 'SPEC_PENDING->SPEC_APPROVED', fixture.now + 4_000),
    /already consumed/
  );
});

test('bot, self, and non-allowlisted reviews fail closed', async () => {
  const bot = await approvalFixture();
  await assert.rejects(
    () => verifyFixture(bot, { persist: false, reviewer: { login: 'robot[bot]', id: 7, type: 'Bot' } }),
    /not a human/
  );

  const outside = await approvalFixture();
  await assert.rejects(
    () => verifyFixture(outside, { persist: false, reviewer: { login: 'mallory', id: 13, type: 'User' } }),
    /outside the immutable allowlist/
  );

  const self = await approvalFixture();
  const conflicted = { login: 'mobilka-agent[bot]', id: 4242, type: 'User' };
  self.kernel.approvalProviders.github.reviewers = [conflicted];
  await assert.rejects(
    () => verifyFixture(self, { persist: false, reviewer: conflicted }),
    /identity separation|keyword=const/
  );
});

test('provider outage, missing history, rejection, and expiry do not invent approval', async () => {
  const outage = await approvalFixture();
  await assert.rejects(
    () => verifyFixture(outage, { persist: false, fetchImpl: async () => { throw new Error('network down'); } }),
    /provider unavailable/
  );
  assert.equal((await readRun(outage.runDir)).approvals.specification, null);

  const missing = await approvalFixture();
  await assert.rejects(() => verifyFixture(missing, { persist: false, reviews: [] }), /history is missing/);

  const rejected = await approvalFixture();
  await assert.rejects(() => verifyFixture(rejected, {
    persist: false,
    reviews: [{ state: 'rejected', environments: [{ name: rejected.request.environment }], user: rejected.kernel.approvalProviders.github.reviewers[0] }]
  }), /rejected or revoked/);

  const expired = await approvalFixture();
  const evidence = githubEvidence(expired.kernel, expired.request);
  await assert.rejects(() => verifyGithubApproval(expired.kernel, expired.runDir, {
    requestPath: expired.requestPath,
    workflowRunId: evidence.workflowRunId,
    fetchImpl: evidence.fetchImpl,
    token: 'test',
    currentCommitSha: expired.commitSha,
    now: Date.parse(expired.request.expiresAt) + 1,
    persist: false
  }), /expired/);
});

test('manual adapter is limited to allowlisted bootstrap specification and never accepts H2 or H3', async () => {
  const fixture = await approvalFixture('release');
  fixture.kernel.approvalProviders.manual.bootstrapRunIds.push(path.basename(fixture.runDir));
  await assert.rejects(
    () => approveRun(fixture.kernel, fixture.runDir, 'acceptance', 'claimed-human'),
    /development-only/
  );
  await assert.rejects(
    () => approveRun(fixture.kernel, fixture.runDir, 'release', 'claimed-human'),
    /development-only/
  );
});

test('trusted workflow path, branch, actor, and display title are independently enforced', async () => {
  const cases = [
    { path: '.github/workflows/changed.yml' },
    { head_branch: 'feature/self-authorize' },
    { display_title: 'human-gate:forged' },
    { actor: { login: 'kapIsWizard', id: 96981818, type: 'User' } }
  ];
  for (const run of cases) {
    const fixture = await approvalFixture();
    await assert.rejects(() => verifyFixture(fixture, { persist: false, run }), /mismatch/);
    assert.equal((await readRun(fixture.runDir)).approvals.specification, null);
  }
});

test('feature-branch policy changes cannot replace the trusted default-branch allowlist', async () => {
  const fixture = await approvalFixture();
  const trustedPolicy = structuredClone(fixture.kernel.approvalProviders);
  const evidence = githubEvidence(fixture.kernel, fixture.request);
  fixture.kernel.approvalProviders.manual.enabled = false;
  const fetchImpl = async (url) => ({
    ok: true,
    status: 200,
    json: async () => {
      if (String(url).includes('/contents/.agentic/approval-providers.json')) {
        return {
          path: '.agentic/approval-providers.json',
          encoding: 'base64',
          content: Buffer.from(JSON.stringify(trustedPolicy)).toString('base64')
        };
      }
      return String(url).endsWith('/approvals') ? evidence.reviews : evidence.run;
    }
  });
  await assert.rejects(() => verifyGithubApproval(fixture.kernel, fixture.runDir, {
    requestPath: fixture.requestPath,
    workflowRunId: evidence.workflowRunId,
    fetchImpl,
    token: 'test',
    currentCommitSha: fixture.commitSha,
    now: fixture.now + 2_000,
    persist: false
  }), /differs from the trusted default-branch policy/);
  assert.equal((await readRun(fixture.runDir)).approvals.specification, null);
});
