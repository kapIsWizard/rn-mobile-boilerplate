import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createContractValidator } from './contracts.mjs';

const SCHEMAS = {
  config: 'https://mobilka.local/schemas/agentic-config.schema.json',
  stateMachine: 'https://mobilka.local/schemas/state-machine.schema.json',
  guardrails: 'https://mobilka.local/schemas/guardrails.schema.json',
  approvalProviders: 'https://mobilka.local/schemas/approval-provider-config.schema.json',
  approval: 'https://mobilka.local/schemas/approval.schema.json',
  workflow: 'https://mobilka.local/schemas/workflow.schema.json',
  runState: 'https://mobilka.local/schemas/run-state.schema.json',
  workflowEvent: 'https://mobilka.local/schemas/workflow-event.schema.json',
  environment: 'https://mobilka.local/schemas/environment-readiness.schema.json'
};

export async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export async function loadKernel(root = process.cwd()) {
  const agenticRoot = path.join(root, '.agentic');
  const contracts = await createContractValidator(root);
  const [config, stateMachine, guardrails, approvalProviders] = await Promise.all([
    loadJson(path.join(agenticRoot, 'config.json')),
    loadJson(path.join(agenticRoot, 'policies/state-machine.json')),
    loadJson(path.join(agenticRoot, 'policies/guardrails.json')),
    loadJson(path.join(agenticRoot, 'approval-providers.json'))
  ]);
  contracts.assertValue(SCHEMAS.config, config, '.agentic/config.json');
  contracts.assertValue(SCHEMAS.stateMachine, stateMachine, '.agentic/policies/state-machine.json');
  contracts.assertValue(SCHEMAS.guardrails, guardrails, '.agentic/policies/guardrails.json');
  contracts.assertValue(SCHEMAS.approvalProviders, approvalProviders, '.agentic/approval-providers.json');
  return { root, agenticRoot, config, stateMachine, guardrails, approvalProviders, contracts };
}

export async function loadWorkflow(kernel, workflow) {
  const relative = `.agentic/workflows/${workflow}.json`;
  const definition = await loadJson(path.join(kernel.root, relative));
  kernel.contracts.assertValue(SCHEMAS.workflow, definition, relative);
  if (definition.name !== workflow) throw new Error(`Workflow name mismatch: ${workflow}`);
  return definition;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

export function digestValue(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

async function digestEntries(target, base = target) {
  const info = await stat(target);
  if (info.isFile()) {
    return [{ path: path.relative(base, target) || path.basename(target), content: await readFile(target) }];
  }
  const entries = [];
  for (const name of (await readdir(target)).sort()) {
    entries.push(...await digestEntries(path.join(target, name), base));
  }
  return entries;
}

export async function digestPath(target) {
  const entries = await digestEntries(path.resolve(target));
  const hash = createHash('sha256');
  for (const entry of entries) {
    hash.update(entry.path);
    hash.update('\0');
    hash.update(entry.content);
    hash.update('\0');
  }
  return hash.digest('hex');
}

export async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, filePath);
}

export async function appendJsonLine(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const handle = await open(filePath, 'a');
  try {
    await handle.appendFile(`${JSON.stringify(value)}\n`, 'utf8');
  } finally {
    await handle.close();
  }
}

function timestamp() {
  return new Date().toISOString();
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'run';
}

export async function initRun(kernel, { name, risk = kernel.config.defaultRisk, workflow = 'develop-feature' }) {
  if (!['fast', 'standard', 'critical'].includes(risk)) throw new Error(`Unsupported risk profile: ${risk}`);
  await loadWorkflow(kernel, workflow);
  const id = `${timestamp().replace(/[:.]/g, '-')}-${slug(name)}`;
  const runDir = path.resolve(kernel.root, kernel.config.runRoot, id);
  const state = {
    schemaVersion: 1,
    id,
    name,
    workflow,
    risk,
    state: kernel.stateMachine.initialState,
    revision: 1,
    createdAt: timestamp(),
    updatedAt: timestamp(),
    digests: { spec: null, environment: null, evidence: null, releaseArtifact: null },
    digestSources: { spec: null, environment: null, evidence: null, releaseArtifact: null },
    approvals: { specification: null, acceptance: null, release: null },
    attempts: Object.fromEntries(Object.keys(kernel.config.iterationLimits).map((key) => [key, 0])),
    attemptWindows: Object.fromEntries(Object.entries(kernel.config.iterationLimits).map(([key, limit]) => [key, {
      baseline: 0,
      limit,
      grantedBy: null,
      grantedAt: null,
      reason: null
    }])),
    failures: [],
    circuitBreaker: { open: false, reason: null }
  };
  kernel.contracts.assertValue(SCHEMAS.runState, state, `${path.relative(kernel.root, runDir)}/state.json`);
  await writeJsonAtomic(path.join(runDir, 'state.json'), state);
  await recordEvent(kernel, runDir, { type: 'run-created', role: 'orchestrator', data: { name, risk, workflow } });
  return { runDir, state };
}

function ensureAttemptWindows(kernel, state) {
  state.attempts ||= {};
  state.attemptWindows ||= {};
  for (const [bucket, limit] of Object.entries(kernel.config.iterationLimits)) {
    if (!Object.hasOwn(state.attempts, bucket)) state.attempts[bucket] = 0;
    state.attemptWindows[bucket] ||= {
      baseline: 0,
      limit,
      grantedBy: null,
      grantedAt: null,
      reason: null
    };
  }
  return state.attemptWindows;
}

function attemptWindowUsage(kernel, state, bucket) {
  const windows = ensureAttemptWindows(kernel, state);
  const window = windows[bucket];
  return { window, used: state.attempts[bucket] - window.baseline };
}

export async function readRun(runDir, kernel = null) {
  const state = await loadJson(path.join(path.resolve(runDir), 'state.json'));
  state.digests.environment ??= null;
  state.digestSources ||= { spec: null, environment: null, evidence: null, releaseArtifact: null };
  state.digestSources.environment ??= null;
  if (kernel) {
    ensureAttemptWindows(kernel, state);
    kernel.contracts.assertValue(SCHEMAS.runState, state, `${path.relative(kernel.root, path.resolve(runDir))}/state.json`);
  }
  return state;
}

async function saveRun(kernel, runDir, state) {
  state.updatedAt = timestamp();
  ensureAttemptWindows(kernel, state);
  kernel.contracts.assertValue(SCHEMAS.runState, state, `${path.relative(kernel.root, path.resolve(runDir))}/state.json`);
  await writeJsonAtomic(path.join(path.resolve(runDir), 'state.json'), state);
}

export async function recordEvent(kernel, runDir, event) {
  const fullEvent = {
    schemaVersion: 1,
    at: timestamp(),
    runId: path.basename(runDir),
    ...event,
    actor: event.actor || event.role
  };
  kernel.contracts.assertValue(SCHEMAS.workflowEvent, fullEvent, `${path.relative(kernel.root, path.resolve(runDir))}/events.jsonl`);
  await appendJsonLine(path.join(runDir, 'events.jsonl'), fullEvent);
  await appendJsonLine(path.resolve(kernel.root, kernel.config.telemetryRoot, 'workflow-events.jsonl'), fullEvent);
}

export function approvalSnapshot(state, gate) {
  if (gate === 'specification') return { spec: state.digests.spec };
  if (gate === 'acceptance') return { spec: state.digests.spec, environment: state.digests.environment, evidence: state.digests.evidence };
  if (gate === 'release') return { spec: state.digests.spec, environment: state.digests.environment, evidence: state.digests.evidence, releaseArtifact: state.digests.releaseArtifact };
  throw new Error(`Unknown gate: ${gate}`);
}

export function isApprovalValid(state, gate) {
  const approval = state.approvals[gate];
  return Boolean(approval && approval.status === 'approved' && digestValue(approval.digestSnapshot) === digestValue(approvalSnapshot(state, gate)));
}

async function assertApprovalForTransition(kernel, runDir, state, gate) {
  if (!isApprovalValid(state, gate)) throw new Error(`Current state requires valid ${gate} approval`);
  const approval = state.approvals[gate];
  if (approval.source === 'human-interaction') {
    const manual = kernel.approvalProviders.manual;
    if (gate !== 'specification' || !manual.enabled || !manual.allowedGates.includes(gate) || !manual.bootstrapRunIds.includes(state.id)) {
      throw new Error('Manual approval adapter is unenforced and cannot authorize this transition');
    }
    return approval;
  }
  if (approval.source !== 'github-environment') throw new Error(`Unsupported approval source: ${approval.source}`);
  const { reverifyRecordedApproval } = await import('./approvals.mjs');
  return reverifyRecordedApproval(kernel, runDir, approval, kernel.approvalRuntime || {});
}

export async function setRunDigest(kernel, runDir, kind, target) {
  if (!Object.hasOwn({ spec: true, environment: true, evidence: true, releaseArtifact: true }, kind)) throw new Error(`Unknown digest kind: ${kind}`);
  const state = await readRun(runDir, kernel);
  const source = path.resolve(target);
  const digest = await digestPath(source);
  state.digestSources ||= { spec: null, environment: null, evidence: null, releaseArtifact: null };
  state.digestSources[kind] = source;
  if (state.digests[kind] !== digest) {
    state.digests[kind] = digest;
    if (kind === 'spec') state.approvals = { specification: null, acceptance: null, release: null };
    if (kind === 'environment') {
      state.approvals.acceptance = null;
      state.approvals.release = null;
    }
    if (kind === 'evidence') {
      state.approvals.acceptance = null;
      state.approvals.release = null;
    }
    if (kind === 'releaseArtifact') state.approvals.release = null;
  }
  await saveRun(kernel, runDir, state);
  await recordEvent(kernel, runDir, { type: 'digest-updated', role: 'orchestrator', data: { kind, digest, target: source } });
  return digest;
}

async function artifactDigestFindings(state) {
  const findings = [];
  for (const kind of ['spec', 'environment', 'evidence', 'releaseArtifact']) {
    if (!state.digests[kind]) continue;
    const source = state.digestSources?.[kind];
    if (!source) {
      findings.push({ severity: 'P1', code: 'MISSING_DIGEST_SOURCE', kind });
      continue;
    }
    try {
      const current = await digestPath(source);
      if (current !== state.digests[kind]) {
        findings.push({ severity: 'P1', code: 'STALE_ARTIFACT_DIGEST', kind, source, expected: state.digests[kind], current });
      }
    } catch (error) {
      findings.push({ severity: 'P1', code: 'DIGEST_SOURCE_UNAVAILABLE', kind, source, error: error.message });
    }
  }
  return findings;
}

async function assertArtifactDigestsCurrent(state) {
  const [finding] = await artifactDigestFindings(state);
  if (finding) throw new Error(`Artifact digest is not current: ${finding.kind} (${finding.code})`);
}

export async function approveRun(kernel, runDir, gate, approvedBy) {
  if (!kernel.config.humanGates.includes(gate)) throw new Error(`Unknown human gate: ${gate}`);
  if (!approvedBy) throw new Error('Human approver identity is required');
  const state = await readRun(runDir, kernel);
  const manual = kernel.approvalProviders.manual;
  const allowedBootstrapRun = manual.bootstrapRunIds.includes(state.id);
  if (!manual.enabled || gate !== 'specification' || !manual.allowedGates.includes(gate) || !allowedBootstrapRun) {
    throw new Error('Manual approval adapter is unenforced and development-only; it is limited to the allowlisted bootstrap specification gate');
  }
  await assertArtifactDigestsCurrent(state);
  const snapshot = approvalSnapshot(state, gate);
  if (Object.values(snapshot).some((value) => !value)) throw new Error(`Gate ${gate} has missing artifact digests`);
  const approval = {
    schemaVersion: 1,
    gate,
    status: 'approved',
    source: 'human-interaction',
    approvedBy,
    approvedAt: timestamp(),
    digestSnapshot: snapshot
  };
  kernel.contracts.assertValue(SCHEMAS.approval, approval, `${path.relative(kernel.root, path.resolve(runDir))}/approvals/${gate}.json`);
  state.approvals[gate] = approval;
  await saveRun(kernel, runDir, state);
  await writeJsonAtomic(path.join(runDir, 'approvals', `${gate}.json`), approval);
  await recordEvent(kernel, runDir, { type: 'human-approval-recorded', role: 'human', actor: approvedBy, data: { gate, approvedBy } });
  return approval;
}

export async function recordExternalApproval(kernel, runDir, approval) {
  if (approval?.source !== 'github-environment') throw new Error('Only externally verified GitHub approval may use the enforced approval path');
  const state = await readRun(runDir, kernel);
  await assertArtifactDigestsCurrent(state);
  const expected = approvalSnapshot(state, approval.gate);
  if (digestValue(expected) !== digestValue(approval.digestSnapshot)) throw new Error('External approval digest snapshot does not match current run state');
  kernel.contracts.assertValue(SCHEMAS.approval, approval, `${path.relative(kernel.root, path.resolve(runDir))}/approvals/${approval.gate}.json`);
  state.approvals[approval.gate] = approval;
  await saveRun(kernel, runDir, state);
  await writeJsonAtomic(path.join(runDir, 'approvals', `${approval.gate}.json`), approval);
  await recordEvent(kernel, runDir, {
    type: 'external-approval-verified',
    role: 'approval-verifier',
    actor: 'github-environment-adapter',
    data: { gate: approval.gate, requestId: approval.requestId, workflowRunId: approval.provider.workflowRunId, reviewerId: approval.approvedById }
  });
  return approval;
}

export async function migrateRunWorkflow(kernel, runDir, workflow, actor = 'orchestrator') {
  const state = await readRun(runDir, kernel);
  if (state.workflow === workflow) return state;
  await assertArtifactDigestsCurrent(state);
  await assertApprovalForTransition(kernel, runDir, state, 'specification');
  const definition = await loadWorkflow(kernel, workflow);
  const specSource = state.digestSources.spec;
  const specInfo = await stat(specSource);
  const specificationFile = specInfo.isDirectory() ? path.join(specSource, 'specification.md') : specSource;
  const specification = await readFile(specificationFile, 'utf8');
  if (!specification.includes(`Proposed workflow: \`${workflow}\``)) {
    throw new Error(`Approved specification does not authorize workflow ${workflow}`);
  }
  if (state.digests.environment) {
    const manifest = await loadJson(state.digestSources.environment);
    kernel.contracts.assertValue(SCHEMAS.environment, manifest, state.digestSources.environment);
    if (manifest.workflow !== workflow || manifest.profile !== definition.preflightProfile) {
      throw new Error(`Existing environment manifest does not authorize workflow ${workflow}`);
    }
  }
  const from = state.workflow;
  state.workflow = workflow;
  await saveRun(kernel, runDir, state);
  await recordEvent(kernel, runDir, {
    type: 'run-workflow-migrated',
    role: 'orchestrator',
    actor,
    data: { from, to: workflow, specificationDigest: state.digests.spec }
  });
  return state;
}

function transitionRule(machine, from, to) {
  return (machine.transitions[from] || []).find((candidate) => candidate.to === to);
}

function requiredGateForState(stateName) {
  if (['SPEC_APPROVED', 'PREFLIGHTING', 'PLANNED', 'IMPLEMENTING', 'VERIFYING', 'DEBUGGING', 'REVIEWING', 'ACCEPTANCE_PENDING'].includes(stateName)) return 'specification';
  if (['ACCEPTED', 'RC_BUILDING', 'FINAL_QA_PENDING'].includes(stateName)) return 'acceptance';
  if (['RELEASE_APPROVED', 'RELEASING', 'OBSERVING', 'COMPLETED'].includes(stateName)) return 'release';
  return null;
}

export async function transitionRun(kernel, runDir, to, role = 'orchestrator', actor = role) {
  if (role !== 'orchestrator') throw new Error('Only the orchestrator may transition run state');
  const state = await readRun(runDir, kernel);
  if (state.circuitBreaker.open) throw new Error(`Circuit breaker is open: ${state.circuitBreaker.reason}`);
  await assertArtifactDigestsCurrent(state);
  const activeGate = requiredGateForState(state.state);
  const verifiedGates = new Map();
  if (activeGate) verifiedGates.set(activeGate, await assertApprovalForTransition(kernel, runDir, state, activeGate));
  const rule = transitionRule(kernel.stateMachine, state.state, to);
  if (!rule) throw new Error(`Invalid transition: ${state.state} -> ${to}`);
  if (rule.requiresDigest && !state.digests[rule.requiresDigest]) throw new Error(`Transition requires ${rule.requiresDigest} digest`);
  if (rule.requiresReadyEnvironment) {
    const source = state.digestSources.environment;
    const manifest = await loadJson(source);
    kernel.contracts.assertValue(SCHEMAS.environment, manifest, source);
    const workflow = await loadWorkflow(kernel, state.workflow);
    if (manifest.profile !== workflow.preflightProfile || manifest.workflow !== state.workflow) {
      throw new Error(`Environment preflight mismatch: workflow ${state.workflow} requires profile ${workflow.preflightProfile}`);
    }
    const requiredChecks = manifest.requiredChecks || [];
    const missingOrBlocked = requiredChecks.filter((id) => manifest.checks?.[id]?.status !== 'ready');
    if (manifest.status !== 'ready' || manifest.blockers?.length || missingOrBlocked.length) {
      throw new Error(`Transition requires ready environment manifest${missingOrBlocked.length ? `: ${missingOrBlocked.join(', ')}` : ''}`);
    }
    if (manifest.secretBoundary?.valuesRecorded !== false || manifest.secretBoundary?.productionAccess !== false) {
      throw new Error('Environment manifest violates the secret or production boundary');
    }
    if (manifest.keyBoundary?.valuesRecorded !== false || manifest.keyBoundary?.productionKeyAccess !== false) {
      throw new Error('Environment manifest violates the cryptographic key boundary');
    }
  }
  if (rule.requiresApproval) {
    if (!verifiedGates.has(rule.requiresApproval)) {
      verifiedGates.set(rule.requiresApproval, await assertApprovalForTransition(kernel, runDir, state, rule.requiresApproval));
    }
    const approval = verifiedGates.get(rule.requiresApproval);
    if (approval.source === 'github-environment') {
      const { consumeApprovalRequest } = await import('./approvals.mjs');
      await consumeApprovalRequest(kernel, runDir, approval, `${state.state}->${to}`, kernel.approvalRuntime?.now);
    }
  }
  const from = state.state;
  state.state = to;
  if (rule.createsRevision) {
    state.revision += 1;
    for (const digest of rule.invalidateDigests || []) {
      state.digests[digest] = null;
      state.digestSources[digest] = null;
    }
    for (const approval of rule.invalidateApprovals || []) state.approvals[approval] = null;
  }
  await saveRun(kernel, runDir, state);
  await recordEvent(kernel, runDir, { type: 'state-transition', role, actor, data: { from, to, revision: state.revision } });
  return state;
}

function attemptBucket(failureClass) {
  if (['ENVIRONMENT_FAILURE', 'DEVICE_FAILURE', 'EXTERNAL_SERVICE_FAILURE'].includes(failureClass)) return 'environment';
  return 'debug';
}

export async function recordFailure(kernel, runDir, { failureClass, signature, evidence = [], role = 'verifier', actor = role }) {
  if (!kernel.guardrails.failureClasses.includes(failureClass)) throw new Error(`Unknown failure class: ${failureClass}`);
  if (!signature) throw new Error('Failure signature is required');
  const state = await readRun(runDir, kernel);
  const bucket = attemptBucket(failureClass);
  state.attempts[bucket] += 1;
  state.failures.push({ at: timestamp(), failureClass, signature, evidence, role });
  const repeated = state.failures.filter((failure) => failure.signature === signature).length;
  const { window, used } = attemptWindowUsage(kernel, state, bucket);
  const overBudget = used > window.limit;
  const repeatedFailure = repeated >= kernel.config.maxRepeatedFailureSignature;
  if (overBudget || repeatedFailure) {
    state.circuitBreaker = {
      open: true,
      reason: overBudget ? `${bucket} iteration budget exhausted` : `failure ${signature} repeated ${repeated} times`
    };
    state.blockedFrom = state.state;
    state.state = 'BLOCKED';
  }
  await saveRun(kernel, runDir, state);
  await recordEvent(kernel, runDir, { type: 'failure-recorded', role, actor, data: { failureClass, signature, evidence, repeated, attempt: used, limit: window.limit, circuitOpen: state.circuitBreaker.open } });
  return state;
}

export async function recordAttempt(kernel, runDir, { bucket, role, evidence = [], actor = role }) {
  if (!Object.hasOwn(kernel.config.iterationLimits, bucket)) throw new Error(`Unknown attempt bucket: ${bucket}`);
  const state = await readRun(runDir, kernel);
  state.attempts[bucket] += 1;
  const { window, used } = attemptWindowUsage(kernel, state, bucket);
  if (used > window.limit) {
    state.circuitBreaker = { open: true, reason: `${bucket} iteration budget exhausted` };
    state.blockedFrom = state.state;
    state.state = 'BLOCKED';
  }
  await saveRun(kernel, runDir, state);
  await recordEvent(kernel, runDir, {
    type: 'attempt-recorded',
    role,
    actor,
    data: { bucket, attempt: used, lifetimeAttempt: state.attempts[bucket], limit: window.limit, evidence, circuitOpen: state.circuitBreaker.open }
  });
  return state;
}

export async function recordGuardrailViolation(kernel, runDir, { signal, role, evidence = [], actor = role }) {
  if (!kernel.guardrails.forbiddenSignals.includes(signal)) throw new Error(`Unknown forbidden signal: ${signal}`);
  if (!role) throw new Error('Reporting role is required');
  if (!evidence.length) throw new Error('Guardrail violation evidence is required');
  const state = await readRun(runDir, kernel);
  if (state.state !== 'BLOCKED') state.blockedFrom = state.state;
  state.state = 'BLOCKED';
  state.circuitBreaker = { open: true, reason: `guardrail violation: ${signal}` };
  await saveRun(kernel, runDir, state);
  await recordEvent(kernel, runDir, {
    type: 'guardrail-violation',
    role,
    actor,
    data: { signal, evidence }
  });
  return state;
}

export async function resumeRun(kernel, runDir, { approvedBy, reason, budgetBucket = null, budgetLimit = null }) {
  const state = await readRun(runDir, kernel);
  if (state.state !== 'BLOCKED' || !state.circuitBreaker.open) throw new Error('Run is not blocked');
  if (!approvedBy || !reason) throw new Error('Human identity and resume reason are required');
  ensureAttemptWindows(kernel, state);
  const exhausted = state.circuitBreaker.reason?.match(/^([A-Za-z0-9]+) iteration budget exhausted$/);
  if (exhausted) {
    const exhaustedBucket = exhausted[1];
    if (budgetBucket !== exhaustedBucket || !Number.isInteger(budgetLimit) || budgetLimit <= 0) {
      throw new Error(`Resuming exhausted ${exhaustedBucket} budget requires an explicit positive --budget ${exhaustedBucket} --limit <n> human grant`);
    }
  }
  let budgetGrant = null;
  if (budgetBucket !== null || budgetLimit !== null) {
    if (!Object.hasOwn(kernel.config.iterationLimits, budgetBucket)) throw new Error(`Unknown budget bucket: ${budgetBucket}`);
    if (!Number.isInteger(budgetLimit) || budgetLimit <= 0) throw new Error('Human-granted budget limit must be a positive integer');
    const grantedAt = timestamp();
    state.attemptWindows[budgetBucket] = {
      baseline: state.attempts[budgetBucket],
      limit: budgetLimit,
      grantedBy: approvedBy,
      grantedAt,
      reason
    };
    budgetGrant = { bucket: budgetBucket, limit: budgetLimit, baseline: state.attempts[budgetBucket], grantedBy: approvedBy, grantedAt };
  }
  state.state = state.blockedFrom || kernel.stateMachine.initialState;
  delete state.blockedFrom;
  state.circuitBreaker = { open: false, reason: null };
  await saveRun(kernel, runDir, state);
  await recordEvent(kernel, runDir, { type: 'human-resume', role: 'human', actor: approvedBy, data: { approvedBy, reason, budgetGrant } });
  return state;
}

export function auditState(kernel, state) {
  const findings = [];
  ensureAttemptWindows(kernel, state);
  if (state.circuitBreaker.open && state.state !== 'BLOCKED') findings.push({ severity: 'P1', code: 'CIRCUIT_STATE_MISMATCH' });
  for (const [bucket, value] of Object.entries(state.attempts)) {
    const window = state.attemptWindows[bucket];
    const used = value - window.baseline;
    if (used > window.limit) findings.push({ severity: 'P1', code: 'ITERATION_BUDGET_EXCEEDED', bucket, value: used, lifetimeValue: value, limit: window.limit });
  }
  for (const gate of kernel.config.humanGates) {
    if (state.approvals[gate] && !isApprovalValid(state, gate)) findings.push({ severity: 'P1', code: 'STALE_APPROVAL', gate });
  }
  const requiredGate = requiredGateForState(state.state);
  if (requiredGate && !isApprovalValid(state, requiredGate)) findings.push({ severity: 'P1', code: 'MISSING_OR_INVALID_GATE', gate: requiredGate, state: state.state });
  return { status: findings.some((finding) => finding.severity === 'P1') ? 'blocked' : 'clean', findings };
}

async function readJsonLines(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    return content.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function auditRun(kernel, runDir) {
  const state = await readRun(runDir, kernel);
  const stateReport = auditState(kernel, state);
  const findings = [...stateReport.findings, ...await artifactDigestFindings(state)];
  const events = await readJsonLines(path.join(path.resolve(runDir), 'events.jsonl'));
  for (const event of events) {
    if (event.type === 'state-transition' && event.role !== 'orchestrator') {
      findings.push({ severity: 'P1', code: 'ROLE_VIOLATION', event: event.at, role: event.role, action: 'state-transition' });
    }
    if (event.type === 'human-approval-recorded' && event.role !== 'human') {
      findings.push({ severity: 'P1', code: 'SELF_APPROVAL', event: event.at, role: event.role });
    }
    if (event.type === 'attempt-recorded' && (!event.data.evidence || event.data.evidence.length === 0) && event.data.attempt > 1) {
      findings.push({ severity: 'P2', code: 'RETRY_WITHOUT_RECORDED_EVIDENCE', event: event.at, actor: event.actor, bucket: event.data.bucket });
    }
    if (event.type === 'failure-recorded' && (!event.data.evidence || event.data.evidence.length === 0)) {
      findings.push({ severity: 'P2', code: 'FAILURE_WITHOUT_RECORDED_EVIDENCE', event: event.at, actor: event.actor, failureClass: event.data.failureClass });
    }
    if (event.type === 'guardrail-violation') {
      findings.push({ severity: 'P1', code: 'GUARDRAIL_VIOLATION', event: event.at, actor: event.actor, signal: event.data.signal, evidence: event.data.evidence });
    }
  }
  if (events.length === 0) findings.push({ severity: 'P2', code: 'INCOMPLETE_TELEMETRY' });
  return {
    status: findings.some((finding) => finding.severity === 'P1') ? 'blocked' : findings.length ? 'warn' : 'clean',
    findings,
    summary: { events: events.length, failures: state.failures.length, state: state.state, revision: state.revision }
  };
}

export async function monitorRuns(kernel, now = Date.now()) {
  const runRoot = path.resolve(kernel.root, kernel.config.runRoot);
  let entries = [];
  try {
    entries = await readdir(runRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const reports = [];
  for (const entry of entries.filter((candidate) => candidate.isDirectory()).sort((left, right) => left.name.localeCompare(right.name))) {
    const runDir = path.join(runRoot, entry.name);
    const state = await readRun(runDir, kernel);
    const report = await auditRun(kernel, runDir);
    reports.push({ runDir, state, report });
  }

  const nonTerminal = reports.filter(({ state }) => !kernel.stateMachine.terminalStates.includes(state.state));
  const grouped = new Map();
  for (const item of nonTerminal) {
    const key = `${item.state.workflow}:${item.state.name}`;
    grouped.set(key, [...(grouped.get(key) || []), item]);
  }
  for (const [objective, items] of grouped) {
    if (items.length <= kernel.config.monitoring.maxActiveRunsPerObjective) continue;
    for (const item of items) {
      item.report.findings.push({
        severity: 'P1',
        code: 'DUPLICATE_ACTIVE_OBJECTIVE',
        objective,
        activeRunIds: items.map(({ state }) => state.id)
      });
      item.report.status = 'blocked';
    }
  }

  const waitingStates = new Set(['SPEC_PENDING', 'ACCEPTANCE_PENDING', 'FINAL_QA_PENDING']);
  for (const item of nonTerminal) {
    if (waitingStates.has(item.state.state)) continue;
    const silentMinutes = Math.floor((now - Date.parse(item.state.updatedAt)) / 60000);
    if (silentMinutes <= kernel.config.monitoring.maxSilentMinutes) continue;
    item.report.findings.push({
      severity: 'P2',
      code: 'STALE_ACTIVE_RUN',
      state: item.state.state,
      silentMinutes,
      threshold: kernel.config.monitoring.maxSilentMinutes
    });
    if (item.report.status === 'clean') item.report.status = 'warn';
  }

  return {
    status: reports.some(({ report }) => report.status === 'blocked')
      ? 'blocked'
      : reports.some(({ report }) => report.status === 'warn') ? 'warn' : 'clean',
    runs: reports.map(({ runDir, state, report }) => ({
      runDir: path.relative(kernel.root, runDir),
      id: state.id,
      name: state.name,
      workflow: state.workflow,
      state: state.state,
      revision: state.revision,
      status: report.status,
      findings: report.findings
    }))
  };
}
