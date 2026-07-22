import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  approveRun,
  auditRun,
  auditState,
  initRun,
  isApprovalValid,
  loadKernel,
  monitorRuns,
  readRun,
  recordAttempt,
  recordFailure,
  recordGuardrailViolation,
  resumeRun,
  setRunDigest,
  transitionRun
} from './lib.mjs';
import { createApprovalRequest, verifyGithubApproval } from './approvals.mjs';

async function testKernel() {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'mobilka-agentic-'));
  const kernel = await loadKernel();
  kernel.config = {
    ...kernel.config,
    runRoot: path.join(temporary, 'runs'),
    telemetryRoot: path.join(temporary, 'telemetry')
  };
  const artifactRoot = path.join(temporary, 'artifacts');
  await mkdir(artifactRoot, { recursive: true });
  return { temporary, kernel, artifactRoot };
}

async function approveBootstrapSpecification(kernel, runDir, approvedBy = 'product-owner') {
  kernel.approvalProviders.manual.bootstrapRunIds.push(path.basename(runDir));
  return approveRun(kernel, runDir, 'specification', approvedBy);
}

async function approveGithubGate(kernel, runDir, gate) {
  const github = kernel.approvalProviders.github;
  github.enabled = true;
  github.agentIdentity = { kind: 'GitHubApp', login: 'mobilka-agent[bot]', id: 4242 };
  const commitSha = 'a'.repeat(40);
  const now = Date.now();
  const request = createApprovalRequest(kernel, await readRun(runDir), { gate, commitSha, now });
  const requestPath = path.join(runDir, 'approval-requests', `${gate}-${request.requestId}.json`);
  await mkdir(path.dirname(requestPath), { recursive: true });
  await writeFile(requestPath, `${JSON.stringify(request, null, 2)}\n`);
  const workflowRunId = 7001;
  const run = {
    id: workflowRunId,
    repository: { id: github.repositoryId, full_name: github.repository },
    event: 'workflow_dispatch',
    path: `.github/workflows/${github.workflowFile}`,
    head_branch: 'main',
    display_title: `human-gate:${gate}:${request.requestId}:${request.requestDigest}`,
    status: 'completed',
    conclusion: 'success',
    actor: { login: github.agentIdentity.login, id: github.agentIdentity.id, type: 'Bot' },
    triggering_actor: { login: github.agentIdentity.login, id: github.agentIdentity.id, type: 'Bot' },
    updated_at: new Date(now + 1_000).toISOString(),
    html_url: `https://github.com/${github.repository}/actions/runs/${workflowRunId}`
  };
  const reviews = [{
    state: 'approved',
    environments: [{ name: github.environments[gate] }],
    user: github.reviewers[0]
  }];
  const fetchImpl = async (url) => ({
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
  });
  kernel.approvalRuntime = { fetchImpl, token: 'test-installation-token', currentCommitSha: commitSha, now: now + 2_000 };
  return verifyGithubApproval(kernel, runDir, {
    requestPath,
    workflowRunId,
    ...kernel.approvalRuntime
  });
}

async function completePreflight(kernel, runDir, artifactRoot) {
  const manifest = path.join(artifactRoot, 'environment.json');
  await writeFile(manifest, `${JSON.stringify({
    schemaVersion: 1,
    profile: 'mobile-e2e',
    workflow: 'develop-feature',
    status: 'ready',
    generatedAt: new Date().toISOString(),
    requiredChecks: ['node', 'agentDevice'],
    checks: {
      node: { status: 'ready', version: process.version, evidence: ['node --version'], reason: null },
      agentDevice: { status: 'ready', version: 'test', evidence: ['agent-device --version'], reason: null }
    },
    identifiers: {
      iosBundleId: 'dev.mobilka.test.e2e',
      androidApplicationId: 'dev.mobilka.test.e2e',
      environment: 'e2e'
    },
    secretBoundary: { valuesRecorded: false, productionAccess: false, inventory: [] },
    keyBoundary: { valuesRecorded: false, productionKeyAccess: false, inventory: [] },
    blockers: []
  }, null, 2)}\n`);
  await transitionRun(kernel, runDir, 'PREFLIGHTING');
  await setRunDigest(kernel, runDir, 'environment', manifest);
  return transitionRun(kernel, runDir, 'PLANNED');
}

test('specification gate blocks transition until a matching human approval exists', async () => {
  const { kernel, artifactRoot } = await testKernel();
  const { runDir } = await initRun(kernel, { name: 'spec gate', risk: 'standard' });
  await transitionRun(kernel, runDir, 'SPEC_PENDING');
  await assert.rejects(() => transitionRun(kernel, runDir, 'SPEC_APPROVED'), /requires spec digest/);

  const spec = path.join(artifactRoot, 'spec.md');
  await writeFile(spec, '# Spec v1\n');
  await setRunDigest(kernel, runDir, 'spec', spec);
  await assert.rejects(() => transitionRun(kernel, runDir, 'SPEC_APPROVED'), /requires valid specification approval/);

  await approveBootstrapSpecification(kernel, runDir);
  const state = await transitionRun(kernel, runDir, 'SPEC_APPROVED');
  assert.equal(state.state, 'SPEC_APPROVED');
});

test('changing the specification invalidates all downstream approvals', async () => {
  const { kernel, artifactRoot } = await testKernel();
  const { runDir } = await initRun(kernel, { name: 'approval invalidation', risk: 'critical' });
  const spec = path.join(artifactRoot, 'spec.md');
  await writeFile(spec, '# Spec v1\n');
  await setRunDigest(kernel, runDir, 'spec', spec);
  await approveBootstrapSpecification(kernel, runDir);
  assert.equal(isApprovalValid(await readRun(runDir), 'specification'), true);

  await writeFile(spec, '# Spec v2\n');
  await setRunDigest(kernel, runDir, 'spec', spec);
  const state = await readRun(runDir);
  assert.equal(state.approvals.specification, null);
  assert.equal(isApprovalValid(state, 'specification'), false);
});

test('a specification change during implementation blocks further transitions', async () => {
  const { kernel, artifactRoot } = await testKernel();
  const { runDir } = await initRun(kernel, { name: 'continuous spec gate', risk: 'standard' });
  const spec = path.join(artifactRoot, 'spec.md');
  await writeFile(spec, '# Approved spec\n');
  await transitionRun(kernel, runDir, 'SPEC_PENDING');
  await setRunDigest(kernel, runDir, 'spec', spec);
  await approveBootstrapSpecification(kernel, runDir);
  await transitionRun(kernel, runDir, 'SPEC_APPROVED');
  await completePreflight(kernel, runDir, artifactRoot);
  await transitionRun(kernel, runDir, 'IMPLEMENTING');

  await writeFile(spec, '# Changed without a new approval\n');
  await setRunDigest(kernel, runDir, 'spec', spec);
  await assert.rejects(() => transitionRun(kernel, runDir, 'VERIFYING'), /Current state requires valid specification approval/);
  const report = auditState(kernel, await readRun(runDir));
  assert.equal(report.status, 'blocked');
  assert.equal(report.findings[0].code, 'MISSING_OR_INVALID_GATE');
});

test('editing an approved artifact without refreshing its digest is detected', async () => {
  const { kernel, artifactRoot } = await testKernel();
  const { runDir } = await initRun(kernel, { name: 'digest bypass', risk: 'standard' });
  const spec = path.join(artifactRoot, 'spec.md');
  await writeFile(spec, '# Approved spec\n');
  await transitionRun(kernel, runDir, 'SPEC_PENDING');
  await setRunDigest(kernel, runDir, 'spec', spec);
  await approveBootstrapSpecification(kernel, runDir);
  await transitionRun(kernel, runDir, 'SPEC_APPROVED');

  await writeFile(spec, '# Edited behind the kernel\n');
  await assert.rejects(() => transitionRun(kernel, runDir, 'PREFLIGHTING'), /STALE_ARTIFACT_DIGEST/);
  const report = await auditRun(kernel, runDir);
  assert.equal(report.status, 'blocked');
  assert.equal(report.findings.some((finding) => finding.code === 'STALE_ARTIFACT_DIGEST'), true);
});

test('the same failure signature opens the circuit breaker on repetition', async () => {
  const { kernel } = await testKernel();
  const { runDir } = await initRun(kernel, { name: 'circuit breaker', risk: 'standard' });
  await recordFailure(kernel, runDir, { failureClass: 'DEVICE_FAILURE', signature: 'device-timeout', evidence: ['first.log'] });
  const state = await recordFailure(kernel, runDir, { failureClass: 'DEVICE_FAILURE', signature: 'device-timeout', evidence: ['second.log'] });
  assert.equal(state.state, 'BLOCKED');
  assert.equal(state.circuitBreaker.open, true);
  assert.match(state.circuitBreaker.reason, /repeated 2 times/);
});

test('a forbidden cryptographic signal blocks the run and remains visible to monitoring', async () => {
  const { kernel } = await testKernel();
  const { runDir } = await initRun(kernel, { name: 'crypto violation', risk: 'critical' });
  const state = await recordGuardrailViolation(kernel, runDir, {
    signal: 'raw-key-material-recorded',
    role: 'reviewer',
    actor: 'security-reviewer',
    evidence: ['artifacts/redacted-finding.json']
  });
  assert.equal(state.state, 'BLOCKED');
  assert.equal(state.circuitBreaker.open, true);
  const report = await auditRun(kernel, runDir);
  assert.equal(report.status, 'blocked');
  assert.equal(report.findings.some((finding) => finding.code === 'GUARDRAIL_VIOLATION' && finding.signal === 'raw-key-material-recorded'), true);
});

test('planning is blocked until the environment manifest is ready and secret-safe', async () => {
  const { kernel, artifactRoot } = await testKernel();
  const { runDir } = await initRun(kernel, { name: 'environment gate', risk: 'critical' });
  const spec = path.join(artifactRoot, 'spec.md');
  const environment = path.join(artifactRoot, 'environment.json');
  await writeFile(spec, '# Approved spec\n');
  await transitionRun(kernel, runDir, 'SPEC_PENDING');
  await setRunDigest(kernel, runDir, 'spec', spec);
  await approveBootstrapSpecification(kernel, runDir);
  await transitionRun(kernel, runDir, 'SPEC_APPROVED');
  await transitionRun(kernel, runDir, 'PREFLIGHTING');
  await assert.rejects(() => transitionRun(kernel, runDir, 'PLANNED'), /requires environment digest/);

  await writeFile(environment, `${JSON.stringify({
    schemaVersion: 1,
    profile: 'mobile-e2e',
    workflow: 'develop-feature',
    status: 'ready',
    generatedAt: new Date().toISOString(),
    requiredChecks: ['agentDevice'],
    checks: { agentDevice: { status: 'ready', version: 'test', evidence: ['version.log'], reason: null } },
    identifiers: { iosBundleId: 'dev.mobilka.test', androidApplicationId: 'dev.mobilka.test', environment: 'e2e' },
    secretBoundary: { valuesRecorded: true, productionAccess: false, inventory: [] },
    keyBoundary: { valuesRecorded: false, productionKeyAccess: false, inventory: [] },
    blockers: []
  }, null, 2)}\n`);
  await setRunDigest(kernel, runDir, 'environment', environment);
  await assert.rejects(() => transitionRun(kernel, runDir, 'PLANNED'), /secretBoundary\/valuesRecorded|secret or production boundary/);
});

test('planning rejects raw or production cryptographic key access in the environment manifest', async () => {
  const { kernel, artifactRoot } = await testKernel();
  const { runDir } = await initRun(kernel, { name: 'key boundary', risk: 'critical' });
  const spec = path.join(artifactRoot, 'spec.md');
  const environment = path.join(artifactRoot, 'environment-key.json');
  await writeFile(spec, '# Approved spec\n');
  await transitionRun(kernel, runDir, 'SPEC_PENDING');
  await setRunDigest(kernel, runDir, 'spec', spec);
  await approveBootstrapSpecification(kernel, runDir);
  await transitionRun(kernel, runDir, 'SPEC_APPROVED');
  await transitionRun(kernel, runDir, 'PREFLIGHTING');

  await writeFile(environment, `${JSON.stringify({
    schemaVersion: 1,
    profile: 'mobile-e2e',
    workflow: 'develop-feature',
    status: 'ready',
    generatedAt: new Date().toISOString(),
    requiredChecks: ['dataProtectionPlan'],
    checks: { dataProtectionPlan: { status: 'ready', version: 'v1', evidence: ['contract.json'], reason: null } },
    identifiers: { iosBundleId: 'dev.mobilka.test', androidApplicationId: 'dev.mobilka.test', environment: 'e2e' },
    secretBoundary: { valuesRecorded: false, productionAccess: false, inventory: [] },
    keyBoundary: { valuesRecorded: true, productionKeyAccess: false, inventory: [] },
    blockers: []
  }, null, 2)}\n`);
  await setRunDigest(kernel, runDir, 'environment', environment);
  await assert.rejects(() => transitionRun(kernel, runDir, 'PLANNED'), /keyBoundary\/valuesRecorded|cryptographic key boundary/);
});

test('control-plane preflight succeeds truthfully without native application identifiers', async () => {
  const { kernel, artifactRoot } = await testKernel();
  const { runDir } = await initRun(kernel, { name: 'control plane', risk: 'critical', workflow: 'harden-control-plane' });
  const spec = path.join(artifactRoot, 'spec.md');
  const environment = path.join(artifactRoot, 'control-plane.json');
  await writeFile(spec, '# Control-plane specification\n');
  await transitionRun(kernel, runDir, 'SPEC_PENDING');
  await setRunDigest(kernel, runDir, 'spec', spec);
  await approveBootstrapSpecification(kernel, runDir);
  await transitionRun(kernel, runDir, 'SPEC_APPROVED');
  await transitionRun(kernel, runDir, 'PREFLIGHTING');
  await writeFile(environment, `${JSON.stringify({
    schemaVersion: 1,
    profile: 'control-plane',
    workflow: 'harden-control-plane',
    status: 'ready',
    generatedAt: new Date().toISOString(),
    requiredChecks: ['node', 'schemaRegistry'],
    checks: {
      node: { status: 'ready', version: process.version, evidence: ['node --version'], reason: null },
      schemaRegistry: { status: 'ready', version: '1', evidence: ['npm run agentic:validate'], reason: null }
    },
    secretBoundary: { valuesRecorded: false, productionAccess: false, inventory: [] },
    keyBoundary: { valuesRecorded: false, productionKeyAccess: false, inventory: [] },
    blockers: []
  }, null, 2)}\n`);
  await setRunDigest(kernel, runDir, 'environment', environment);
  assert.equal((await transitionRun(kernel, runDir, 'PLANNED')).state, 'PLANNED');
});

test('planning fails closed when the committed trust policy belongs to another repository', async () => {
  const { kernel, artifactRoot } = await testKernel();
  const { runDir } = await initRun(kernel, { name: 'inherited trust binding', risk: 'critical', workflow: 'harden-control-plane' });
  const spec = path.join(artifactRoot, 'spec.md');
  const environment = path.join(artifactRoot, 'control-plane.json');
  await writeFile(spec, '# Control-plane specification\n');
  await transitionRun(kernel, runDir, 'SPEC_PENDING');
  await setRunDigest(kernel, runDir, 'spec', spec);
  await approveBootstrapSpecification(kernel, runDir);
  await transitionRun(kernel, runDir, 'SPEC_APPROVED');
  await transitionRun(kernel, runDir, 'PREFLIGHTING');
  await writeFile(environment, `${JSON.stringify({
    schemaVersion: 1,
    profile: 'control-plane',
    workflow: 'harden-control-plane',
    status: 'ready',
    generatedAt: new Date().toISOString(),
    requiredChecks: ['node'],
    checks: { node: { status: 'ready', version: process.version, evidence: ['node --version'], reason: null } },
    secretBoundary: { valuesRecorded: false, productionAccess: false, inventory: [] },
    keyBoundary: { valuesRecorded: false, productionKeyAccess: false, inventory: [] },
    blockers: []
  }, null, 2)}\n`);
  await setRunDigest(kernel, runDir, 'environment', environment);
  kernel.approvalProviders.github.repository = 'source-template/inherited-repository';
  await assert.rejects(() => transitionRun(kernel, runDir, 'PLANNED'), /Repository binding mismatch/);
  assert.equal((await readRun(runDir)).state, 'PREFLIGHTING');
});

test('mobile workflow cannot bypass native readiness with the control-plane profile', async () => {
  const { kernel, artifactRoot } = await testKernel();
  const { runDir } = await initRun(kernel, { name: 'mobile bypass', risk: 'critical', workflow: 'develop-feature' });
  const spec = path.join(artifactRoot, 'spec.md');
  const environment = path.join(artifactRoot, 'wrong-profile.json');
  await writeFile(spec, '# Mobile specification\n');
  await transitionRun(kernel, runDir, 'SPEC_PENDING');
  await setRunDigest(kernel, runDir, 'spec', spec);
  await approveBootstrapSpecification(kernel, runDir);
  await transitionRun(kernel, runDir, 'SPEC_APPROVED');
  await transitionRun(kernel, runDir, 'PREFLIGHTING');
  await writeFile(environment, `${JSON.stringify({
    schemaVersion: 1,
    profile: 'control-plane',
    workflow: 'harden-control-plane',
    status: 'ready',
    generatedAt: new Date().toISOString(),
    requiredChecks: ['node'],
    checks: { node: { status: 'ready', version: process.version, evidence: ['node --version'], reason: null } },
    secretBoundary: { valuesRecorded: false, productionAccess: false, inventory: [] },
    keyBoundary: { valuesRecorded: false, productionKeyAccess: false, inventory: [] },
    blockers: []
  }, null, 2)}\n`);
  await setRunDigest(kernel, runDir, 'environment', environment);
  await assert.rejects(() => transitionRun(kernel, runDir, 'PLANNED'), /preflight mismatch/);
});

test('device verification cannot advance to review without evidence', async () => {
  const { kernel, artifactRoot } = await testKernel();
  const { runDir } = await initRun(kernel, { name: 'evidence gate', risk: 'standard' });
  const spec = path.join(artifactRoot, 'spec.md');
  await writeFile(spec, '# Approved spec\n');
  await transitionRun(kernel, runDir, 'SPEC_PENDING');
  await setRunDigest(kernel, runDir, 'spec', spec);
  await approveBootstrapSpecification(kernel, runDir);
  await transitionRun(kernel, runDir, 'SPEC_APPROVED');
  await completePreflight(kernel, runDir, artifactRoot);
  await transitionRun(kernel, runDir, 'IMPLEMENTING');
  await transitionRun(kernel, runDir, 'VERIFYING');
  await assert.rejects(() => transitionRun(kernel, runDir, 'REVIEWING'), /requires evidence digest/);
  assert.equal(auditState(kernel, await readRun(runDir)).status, 'clean');
});

test('only the orchestrator may move workflow state', async () => {
  const { kernel } = await testKernel();
  const { runDir } = await initRun(kernel, { name: 'role boundary', risk: 'standard' });
  await assert.rejects(
    () => transitionRun(kernel, runDir, 'SPEC_PENDING', 'builder'),
    /Only the orchestrator/
  );
  assert.equal((await readRun(runDir)).state, 'DRAFT');
});

test('final QA rejection preserves the approved specification but invalidates downstream proof', async () => {
  const { kernel, artifactRoot } = await testKernel();
  const { runDir } = await initRun(kernel, { name: 'release repair revision', risk: 'critical' });
  const spec = path.join(artifactRoot, 'spec.md');
  const evidence = path.join(artifactRoot, 'evidence.json');
  const releaseArtifact = path.join(artifactRoot, 'build.json');
  await writeFile(spec, '# Approved spec\n');
  await writeFile(evidence, '{"result":"verified"}\n');
  await writeFile(releaseArtifact, '{"build":"rc-1"}\n');

  await transitionRun(kernel, runDir, 'SPEC_PENDING');
  await setRunDigest(kernel, runDir, 'spec', spec);
  await approveBootstrapSpecification(kernel, runDir);
  await transitionRun(kernel, runDir, 'SPEC_APPROVED');
  await completePreflight(kernel, runDir, artifactRoot);
  await transitionRun(kernel, runDir, 'IMPLEMENTING');
  await transitionRun(kernel, runDir, 'VERIFYING');
  await setRunDigest(kernel, runDir, 'evidence', evidence);
  await transitionRun(kernel, runDir, 'REVIEWING');
  await transitionRun(kernel, runDir, 'ACCEPTANCE_PENDING');
  await approveGithubGate(kernel, runDir, 'acceptance');
  await transitionRun(kernel, runDir, 'ACCEPTED');
  await transitionRun(kernel, runDir, 'RC_BUILDING');
  await setRunDigest(kernel, runDir, 'releaseArtifact', releaseArtifact);
  await transitionRun(kernel, runDir, 'FINAL_QA_PENDING');
  const state = await transitionRun(kernel, runDir, 'DEBUGGING');

  assert.equal(state.revision, 2);
  assert.equal(isApprovalValid(state, 'specification'), true);
  assert.notEqual(state.digests.environment, null);
  assert.equal(state.digests.evidence, null);
  assert.equal(state.digests.releaseArtifact, null);
  assert.equal(state.approvals.acceptance, null);
  assert.equal(state.approvals.release, null);
  assert.equal(auditState(kernel, state).status, 'clean');
});

test('human resume returns a blocked run to the state where the breaker opened', async () => {
  const { kernel } = await testKernel();
  const { runDir } = await initRun(kernel, { name: 'bounded resume', risk: 'standard' });
  await recordFailure(kernel, runDir, { failureClass: 'DEVICE_FAILURE', signature: 'device-timeout', evidence: ['first.log'] });
  await recordFailure(kernel, runDir, { failureClass: 'DEVICE_FAILURE', signature: 'device-timeout', evidence: ['second.log'] });
  const resumed = await resumeRun(kernel, runDir, { approvedBy: 'product-owner', reason: 'device lease replaced' });
  assert.equal(resumed.state, 'DRAFT');
  assert.equal(resumed.circuitBreaker.open, false);
  assert.equal(Object.hasOwn(resumed, 'blockedFrom'), false);
});

test('human resume grants a fresh bounded attempt window without erasing lifetime attempts', async () => {
  const { kernel } = await testKernel();
  const { runDir } = await initRun(kernel, { name: 'budget grant', risk: 'critical' });
  for (let index = 0; index < 4; index += 1) {
    await recordAttempt(kernel, runDir, { bucket: 'debug', role: 'debugger', evidence: [`attempt-${index}.log`] });
  }
  assert.equal((await readRun(runDir)).state, 'BLOCKED');
  await assert.rejects(
    () => resumeRun(kernel, runDir, { approvedBy: 'product-owner', reason: 'new hypothesis' }),
    /requires an explicit positive/
  );

  const resumed = await resumeRun(kernel, runDir, {
    approvedBy: 'product-owner',
    reason: 'three attempts for a materially different hypothesis',
    budgetBucket: 'debug',
    budgetLimit: 3
  });
  assert.equal(resumed.state, 'DRAFT');
  assert.equal(resumed.attempts.debug, 4);
  assert.equal(resumed.attemptWindows.debug.baseline, 4);
  assert.equal(resumed.attemptWindows.debug.limit, 3);
  assert.equal(auditState(kernel, resumed).status, 'clean');

  for (let index = 0; index < 3; index += 1) {
    const state = await recordAttempt(kernel, runDir, { bucket: 'debug', role: 'debugger', evidence: [`new-attempt-${index}.log`] });
    assert.notEqual(state.state, 'BLOCKED');
  }
  const blocked = await recordAttempt(kernel, runDir, { bucket: 'debug', role: 'debugger', evidence: ['new-attempt-4.log'] });
  assert.equal(blocked.state, 'BLOCKED');
  assert.equal(blocked.attempts.debug, 8);
});

test('repository monitor blocks duplicate active objectives', async () => {
  const { kernel } = await testKernel();
  await initRun(kernel, { name: 'same objective', risk: 'standard', workflow: 'develop-feature' });
  await initRun(kernel, { name: 'same objective', risk: 'standard', workflow: 'develop-feature' });
  const report = await monitorRuns(kernel);
  assert.equal(report.status, 'blocked');
  assert.equal(report.runs.length, 2);
  assert.equal(report.runs.every((run) => run.findings.some((finding) => finding.code === 'DUPLICATE_ACTIVE_OBJECTIVE')), true);
});
