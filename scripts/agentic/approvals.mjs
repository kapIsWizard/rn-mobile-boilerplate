import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  approvalSnapshot,
  digestValue,
  readRun,
  recordEvent,
  recordExternalApproval,
  writeJsonAtomic
} from './lib.mjs';

const execFileAsync = promisify(execFile);
const REQUEST_SCHEMA = 'https://mobilka.local/schemas/approval-request.schema.json';
const APPROVAL_SCHEMA = 'https://mobilka.local/schemas/approval.schema.json';
const CONSUMPTION_SCHEMA = 'https://mobilka.local/schemas/approval-consumption.schema.json';
const PROVIDER_SCHEMA = 'https://mobilka.local/schemas/approval-provider-config.schema.json';

function timestamp(value = Date.now()) {
  return new Date(value).toISOString();
}

function requestPayload(request) {
  const { requestDigest: _requestDigest, ...payload } = request;
  return payload;
}

export function calculateRequestDigest(request) {
  return digestValue(requestPayload(request));
}

function assertExact(label, actual, expected) {
  if (actual !== expected) throw new Error(`${label} mismatch`);
}

function assertDigestSnapshot(actual, expected) {
  if (digestValue(actual) !== digestValue(expected)) throw new Error('Approval request digest snapshot mismatch');
}

async function gitHead(root) {
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root });
  return stdout.trim();
}

function githubHeaders(config, token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': config.apiVersion,
    'User-Agent': 'rn-mobile-boilerplate-agentic-kernel'
  };
}

async function githubJson(fetchImpl, url, options, operation) {
  let response;
  try {
    response = await fetchImpl(url, options);
  } catch (error) {
    throw new Error(`GitHub approval provider unavailable during ${operation}: ${error.message}`);
  }
  if (!response.ok) throw new Error(`GitHub approval provider rejected ${operation}: HTTP ${response.status}`);
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`GitHub approval provider returned inconsistent ${operation} evidence: ${error.message}`);
  }
}

async function loadTrustedApprovalProviders(kernel, fetchImpl, token) {
  const local = kernel.approvalProviders;
  const github = local.github;
  const [owner, repository] = github.repository.split('/');
  const trustedBranch = github.trustedRef.replace('refs/heads/', '');
  const policyPath = '.agentic/approval-providers.json';
  const url = `${github.apiBaseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents/${policyPath}?ref=${encodeURIComponent(trustedBranch)}`;
  const response = await githubJson(fetchImpl, url, { headers: githubHeaders(github, token) }, 'trusted approval policy lookup');
  if (response.path !== policyPath || response.encoding !== 'base64' || typeof response.content !== 'string') {
    throw new Error('GitHub trusted approval policy response is inconsistent');
  }
  let trusted;
  try {
    trusted = JSON.parse(Buffer.from(response.content.replace(/\s/g, ''), 'base64').toString('utf8'));
  } catch (error) {
    throw new Error(`GitHub trusted approval policy is not valid JSON: ${error.message}`);
  }
  kernel.contracts.assertValue(PROVIDER_SCHEMA, trusted, `${github.trustedRef}:${policyPath}`);
  if (digestValue(trusted) !== digestValue(local)) {
    throw new Error('Local approval policy differs from the trusted default-branch policy');
  }
  return trusted;
}

export function createApprovalRequest(kernel, state, {
  gate,
  commitSha,
  requestId = randomUUID(),
  now = Date.now(),
  ttlMinutes = 30
}) {
  if (!kernel.config.humanGates.includes(gate)) throw new Error(`Unknown human gate: ${gate}`);
  if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > 1440) throw new Error('Approval request TTL must be an integer from 1 to 1440 minutes');
  if (!/^[a-f0-9]{40}$/.test(commitSha)) throw new Error('Approval request requires an exact 40-character commit SHA');
  const snapshot = approvalSnapshot(state, gate);
  if (Object.values(snapshot).some((value) => !value)) throw new Error(`Gate ${gate} has missing artifact digests`);
  const github = kernel.approvalProviders.github;
  const request = {
    schemaVersion: 1,
    provider: 'github-environment',
    repository: github.repository,
    repositoryId: github.repositoryId,
    runId: state.id,
    gate,
    revision: state.revision,
    digestSnapshot: snapshot,
    commitSha,
    requestId,
    environment: github.environments[gate],
    workflowFile: github.workflowFile,
    trustedRef: github.trustedRef,
    createdAt: timestamp(now),
    expiresAt: timestamp(now + ttlMinutes * 60_000)
  };
  request.requestDigest = calculateRequestDigest(request);
  kernel.contracts.assertValue(REQUEST_SCHEMA, request, '<approval-request>');
  return request;
}

export async function requestGithubApproval(kernel, runDir, {
  gate,
  ttlMinutes = 30,
  fetchImpl = globalThis.fetch,
  token = process.env[kernel.approvalProviders.github.tokenEnv],
  now = Date.now(),
  commitSha = null
}) {
  const localGithub = kernel.approvalProviders.github;
  if (!localGithub.enabled) throw new Error('GitHub approval provider is not enabled');
  if (!localGithub.agentIdentity.login || !localGithub.agentIdentity.id) throw new Error('GitHub App agent identity is not configured');
  if (!token) throw new Error(`Missing ${localGithub.tokenEnv}; approval request was not dispatched`);
  const trustedProviders = await loadTrustedApprovalProviders(kernel, fetchImpl, token);
  const github = trustedProviders.github;
  const state = await readRun(runDir, kernel);
  const currentCommit = commitSha || await gitHead(kernel.root);
  const request = createApprovalRequest(kernel, state, { gate, commitSha: currentCommit, now, ttlMinutes });
  const requestPath = path.join(path.resolve(runDir), 'approval-requests', `${gate}-${request.requestId}.json`);
  await writeJsonAtomic(requestPath, request);

  const [owner, repository] = github.repository.split('/');
  const workflow = encodeURIComponent(github.workflowFile);
  const url = `${github.apiBaseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/actions/workflows/${workflow}/dispatches`;
  const response = await githubJson(fetchImpl, url, {
    method: 'POST',
    headers: { ...githubHeaders(github, token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ref: github.trustedRef.replace('refs/heads/', ''),
      inputs: {
        repository_id: String(request.repositoryId),
        run_id: request.runId,
        gate: request.gate,
        revision: String(request.revision),
        digest_snapshot: JSON.stringify(request.digestSnapshot),
        commit_sha: request.commitSha,
        request_id: request.requestId,
        request_digest: request.requestDigest,
        expires_at: request.expiresAt
      }
    })
  }, 'workflow dispatch');
  if (!Number.isInteger(response.workflow_run_id) || response.workflow_run_id < 1) {
    throw new Error('GitHub approval provider returned no workflow run identity');
  }
  await recordEvent(kernel, runDir, {
    type: 'approval-request-dispatched',
    role: 'orchestrator',
    actor: github.agentIdentity.login,
    data: { gate, requestId: request.requestId, requestDigest: request.requestDigest, workflowRunId: response.workflow_run_id }
  });
  return { request, requestPath, workflowRunId: response.workflow_run_id, workflowRunUrl: response.html_url };
}

function assertCurrentRequest(kernel, state, request, currentCommitSha, now, github) {
  kernel.contracts.assertValue(REQUEST_SCHEMA, request, '<approval-request>');
  assertExact('Approval request digest', request.requestDigest, calculateRequestDigest(request));
  assertExact('Approval repository', request.repository, github.repository);
  assertExact('Approval repository ID', request.repositoryId, github.repositoryId);
  assertExact('Approval run', request.runId, state.id);
  assertExact('Approval revision', request.revision, state.revision);
  assertExact('Approval commit', request.commitSha, currentCommitSha);
  assertExact('Approval environment', request.environment, github.environments[request.gate]);
  assertExact('Approval workflow', request.workflowFile, github.workflowFile);
  assertExact('Approval trusted ref', request.trustedRef, github.trustedRef);
  assertDigestSnapshot(request.digestSnapshot, approvalSnapshot(state, request.gate));
  if (Date.parse(request.createdAt) > now) throw new Error('Approval request creation time is in the future');
  if (Date.parse(request.expiresAt) <= now) throw new Error('Approval request expired');
}

function selectHumanReview(github, reviews, environment) {
  if (!Array.isArray(reviews)) throw new Error('GitHub approval review history is inconsistent');
  const relevant = reviews.filter((review) =>
    Array.isArray(review.environments) && review.environments.some((item) => item?.name === environment)
  );
  if (relevant.length === 0) throw new Error('GitHub approval review history is missing for the expected environment');
  if (relevant.some((review) => String(review.state).toLowerCase() !== 'approved')) {
    throw new Error('GitHub approval review history contains rejected or revoked evidence');
  }
  const review = relevant.at(-1);
  const reviewer = review.user;
  if (!reviewer || reviewer.type !== 'User') throw new Error('GitHub approval reviewer is not a human user');
  const allowlisted = github.reviewers.some((candidate) =>
    candidate.id === reviewer.id && candidate.login.toLowerCase() === String(reviewer.login).toLowerCase() && candidate.type === reviewer.type
  );
  if (!allowlisted) throw new Error('GitHub approval reviewer is outside the immutable allowlist');
  return review;
}

export async function verifyGithubApproval(kernel, runDir, {
  requestPath,
  workflowRunId,
  fetchImpl = globalThis.fetch,
  token = process.env[kernel.approvalProviders.github.tokenEnv],
  now = Date.now(),
  currentCommitSha = null,
  persist = true
}) {
  const localGithub = kernel.approvalProviders.github;
  if (!localGithub.enabled) throw new Error('GitHub approval provider is not enabled');
  if (!localGithub.agentIdentity.login || !localGithub.agentIdentity.id) throw new Error('GitHub App agent identity is not configured');
  if (!token) throw new Error(`Missing ${localGithub.tokenEnv}; approval verification fails closed`);
  if (!Number.isInteger(workflowRunId) || workflowRunId < 1) throw new Error('Workflow run ID must be a positive integer');

  const trustedProviders = await loadTrustedApprovalProviders(kernel, fetchImpl, token);
  const github = trustedProviders.github;
  const state = await readRun(runDir, kernel);
  const request = JSON.parse(await readFile(path.resolve(requestPath), 'utf8'));
  const currentCommit = currentCommitSha || await gitHead(kernel.root);
  assertCurrentRequest(kernel, state, request, currentCommit, now, github);

  const [owner, repository] = github.repository.split('/');
  const base = `${github.apiBaseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/actions/runs/${workflowRunId}`;
  const headers = githubHeaders(github, token);
  const [run, reviews] = await Promise.all([
    githubJson(fetchImpl, base, { headers }, 'workflow run lookup'),
    githubJson(fetchImpl, `${base}/approvals`, { headers }, 'review history lookup')
  ]);

  assertExact('Workflow run ID', run.id, workflowRunId);
  assertExact('Workflow repository ID', run.repository?.id, github.repositoryId);
  assertExact('Workflow repository', String(run.repository?.full_name).toLowerCase(), github.repository.toLowerCase());
  assertExact('Workflow event', run.event, 'workflow_dispatch');
  assertExact('Workflow path', run.path, `.github/workflows/${github.workflowFile}`);
  assertExact('Workflow trusted branch', run.head_branch, github.trustedRef.replace('refs/heads/', ''));
  assertExact('Workflow display title', run.display_title, `human-gate:${request.gate}:${request.requestId}:${request.requestDigest}`);
  assertExact('Workflow status', run.status, 'completed');
  assertExact('Workflow conclusion', run.conclusion, 'success');
  assertExact('Workflow actor login', String(run.actor?.login).toLowerCase(), github.agentIdentity.login.toLowerCase());
  assertExact('Workflow actor ID', run.actor?.id, github.agentIdentity.id);
  assertExact('Workflow triggering actor login', String(run.triggering_actor?.login).toLowerCase(), github.agentIdentity.login.toLowerCase());
  assertExact('Workflow triggering actor ID', run.triggering_actor?.id, github.agentIdentity.id);

  const review = selectHumanReview(github, reviews, request.environment);
  if (review.user.id === run.actor.id || String(review.user.login).toLowerCase() === String(run.actor.login).toLowerCase()) {
    throw new Error('GitHub approval violates requester/reviewer identity separation');
  }

  const verifiedAt = timestamp(now);
  const approval = {
    schemaVersion: 1,
    gate: request.gate,
    status: 'approved',
    source: 'github-environment',
    approvedBy: review.user.login,
    approvedById: review.user.id,
    approvedAt: run.updated_at,
    digestSnapshot: request.digestSnapshot,
    requestId: request.requestId,
    requestDigest: request.requestDigest,
    commitSha: request.commitSha,
    expiresAt: request.expiresAt,
    verifiedAt,
    provider: {
      name: 'github-environment',
      repository: github.repository,
      repositoryId: github.repositoryId,
      workflowRunId,
      workflowRunUrl: run.html_url,
      workflowFile: github.workflowFile,
      trustedRef: github.trustedRef,
      environment: request.environment,
      reviewState: 'approved',
      reviewerLogin: review.user.login,
      reviewerId: review.user.id,
      reviewedAt: run.updated_at,
      requestActorLogin: run.actor.login,
      requestActorId: run.actor.id
    }
  };
  kernel.contracts.assertValue(APPROVAL_SCHEMA, approval, '<github-approval>');
  if (persist) await recordExternalApproval(kernel, runDir, approval);
  return approval;
}

export async function reverifyRecordedApproval(kernel, runDir, approval, options = {}) {
  if (approval.source !== 'github-environment') return approval;
  const requestPath = path.join(path.resolve(runDir), 'approval-requests', `${approval.gate}-${approval.requestId}.json`);
  const verified = await verifyGithubApproval(kernel, runDir, {
    ...options,
    requestPath,
    workflowRunId: approval.provider.workflowRunId,
    persist: false
  });
  for (const field of ['gate', 'approvedBy', 'approvedById', 'requestId', 'requestDigest', 'commitSha']) {
    assertExact(`Reverified approval ${field}`, verified[field], approval[field]);
  }
  return verified;
}

export async function consumeApprovalRequest(kernel, runDir, approval, transition, now = Date.now()) {
  if (approval.source !== 'github-environment') return null;
  const consumption = {
    schemaVersion: 1,
    requestId: approval.requestId,
    requestDigest: approval.requestDigest,
    runId: path.basename(path.resolve(runDir)),
    gate: approval.gate,
    revision: (await readRun(runDir, kernel)).revision,
    consumedAt: timestamp(now),
    transition
  };
  kernel.contracts.assertValue(CONSUMPTION_SCHEMA, consumption, '<approval-consumption>');
  const ledgerPath = path.join(path.resolve(runDir), 'approval-consumptions', `${approval.requestId}.json`);
  let handle;
  try {
    await mkdir(path.dirname(ledgerPath), { recursive: true });
    handle = await open(ledgerPath, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error(`Approval request ${approval.requestId} was already consumed`);
    } else {
      throw error;
    }
  }
  try {
    await handle.writeFile(`${JSON.stringify(consumption, null, 2)}\n`, 'utf8');
  } finally {
    await handle.close();
  }
  return consumption;
}
