import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const PROTECTED_CODEOWNER_PATHS = [
  '*',
  '/.github/',
  '/.agentic/',
  '/scripts/agentic/',
  '/docs/requirements/',
  '/docs/operations/',
  '/environment/',
  '/security/',
  '/package.json',
  '/package-lock.json'
];

function normalize(value) {
  return String(value).toLowerCase();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function githubHeaders(apiVersion, token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': apiVersion,
    'User-Agent': 'rn-mobile-boilerplate-trust-bootstrap'
  };
}

async function githubJson(fetchImpl, url, apiVersion, token, operation) {
  let response;
  try {
    response = await fetchImpl(url, { headers: githubHeaders(apiVersion, token) });
  } catch (error) {
    throw new Error(`GitHub metadata unavailable during ${operation}: ${error.message}`);
  }
  if (!response.ok) throw new Error(`GitHub metadata rejected ${operation}: HTTP ${response.status}`);
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`GitHub metadata was inconsistent during ${operation}: ${error.message}`);
  }
}

export function validateTrustPolicyInvariants(policy) {
  const errors = [];
  const reviewers = policy?.github?.reviewers || [];
  const reviewerLogins = new Set();
  const reviewerIds = new Set();

  if (reviewers.length === 0) errors.push('approval providers: human reviewer allowlist must not be empty');
  for (const reviewer of reviewers) {
    const login = normalize(reviewer?.login);
    if (reviewer?.type !== 'User') errors.push(`approval providers: reviewer ${reviewer?.login || '<unknown>'} must be a human User`);
    if (reviewerLogins.has(login)) errors.push(`approval providers: duplicate reviewer login ${reviewer.login}`);
    if (reviewerIds.has(reviewer?.id)) errors.push(`approval providers: duplicate reviewer immutable ID ${reviewer?.id}`);
    reviewerLogins.add(login);
    reviewerIds.add(reviewer?.id);
  }

  const agent = policy?.github?.agentIdentity;
  const agentConfigured = Boolean(agent?.login && agent?.id);
  const agentEmpty = agent?.login === null && agent?.id === null;
  if (!agentConfigured && !agentEmpty) errors.push('approval providers: agent login and immutable ID must be configured together');
  if (agentConfigured && (reviewerLogins.has(normalize(agent.login)) || reviewerIds.has(agent.id))) {
    errors.push('approval providers: agent identity must be distinct from every human reviewer');
  }

  const environmentNames = Object.values(policy?.github?.environments || {}).map(normalize);
  if (new Set(environmentNames).size !== environmentNames.length) {
    errors.push('approval providers: each human gate must use a distinct protected environment');
  }
  if (policy?.manual?.allowedGates?.some((gate) => gate !== 'specification')) {
    errors.push('approval providers: manual adapter may authorize only the bootstrap specification gate');
  }
  if (policy?.mode === 'enforced') {
    if (policy.manual.enabled) errors.push('approval providers: enforced mode must disable manual approval');
    if (!policy.github.enabled) errors.push('approval providers: enforced mode must enable GitHub approval');
    if (!agentConfigured) errors.push('approval providers: enforced mode requires a complete GitHub App identity');
  }

  if (errors.length) throw new Error(errors.join('\n'));
  return policy;
}

export function renderCodeowners(reviewers) {
  const owners = reviewers.map((reviewer) => `@${reviewer.login}`).join(' ');
  return [
    '# Generated human-owned trust root. Branch protection must require this review on main.',
    ...PROTECTED_CODEOWNER_PATHS.map((protectedPath) => `${protectedPath} ${owners}`),
    ''
  ].join('\n');
}

export function assertCodeownersBinding(codeowners, reviewers) {
  const expectedOwners = new Set(reviewers.map((reviewer) => `@${normalize(reviewer.login)}`));
  const entries = new Map();
  for (const rawLine of codeowners.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const [protectedPath, ...owners] = line.split(/\s+/);
    entries.set(protectedPath, new Set(owners.map(normalize)));
  }
  for (const protectedPath of PROTECTED_CODEOWNER_PATHS) {
    const actual = entries.get(protectedPath);
    assert(actual, `CODEOWNERS: missing protected path ${protectedPath}`);
    const missing = [...expectedOwners].filter((owner) => !actual.has(owner));
    const inherited = [...actual].filter((owner) => !expectedOwners.has(owner));
    assert(missing.length === 0, `CODEOWNERS: ${protectedPath} is missing ${missing.join(', ')}`);
    assert(inherited.length === 0, `CODEOWNERS: ${protectedPath} contains inherited owners ${inherited.join(', ')}`);
  }
  return true;
}

export function repositoryFromRemote(remote) {
  const value = String(remote || '').trim();
  let host;
  let pathname;
  const scp = value.match(/^git@([^:]+):(.+)$/);
  if (scp) {
    [, host, pathname] = scp;
  } else {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error('Repository binding requires a GitHub origin URL');
    }
    host = parsed.hostname;
    pathname = parsed.pathname.replace(/^\//, '');
  }
  assert(normalize(host) === 'github.com', 'Repository binding supports only github.com in this provider');
  const repository = pathname.replace(/\.git$/, '').replace(/^\//, '');
  assert(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository), 'Repository binding could not derive owner/name from origin');
  return repository;
}

export async function readRepositoryContext(root, {
  env = process.env,
  execFileImpl = execFileAsync,
  remote = null
} = {}) {
  if (env.GITHUB_REPOSITORY) {
    const repositoryId = env.GITHUB_REPOSITORY_ID ? Number(env.GITHUB_REPOSITORY_ID) : null;
    if (repositoryId !== null && (!Number.isInteger(repositoryId) || repositoryId < 1)) {
      throw new Error('GITHUB_REPOSITORY_ID must be a positive integer');
    }
    return { repository: env.GITHUB_REPOSITORY, repositoryId, source: 'github-actions' };
  }
  let origin = remote;
  if (origin === null) {
    try {
      const result = await execFileImpl('git', ['remote', 'get-url', 'origin'], { cwd: root });
      origin = result.stdout.trim();
    } catch (error) {
      throw new Error(`Repository binding requires origin metadata: ${error.message}`);
    }
  }
  return { repository: repositoryFromRemote(origin), repositoryId: null, source: 'git-origin' };
}

export function assertRepositoryBinding(policy, context) {
  assert(context?.repository, 'Repository binding context is missing');
  assert(normalize(policy.github.repository) === normalize(context.repository),
    `Repository binding mismatch: policy=${policy.github.repository} actual=${context.repository}`);
  if (context.repositoryId !== null && context.repositoryId !== undefined) {
    assert(policy.github.repositoryId === context.repositoryId,
      `Repository ID binding mismatch: policy=${policy.github.repositoryId} actual=${context.repositoryId}`);
  }
  return true;
}

function sameReviewers(left, right) {
  const canonical = (reviewers) => reviewers
    .map((reviewer) => `${normalize(reviewer.login)}:${reviewer.id}:${reviewer.type}`)
    .sort();
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

async function resolveIdentity({ apiBaseUrl, apiVersion, fetchImpl, login, token, expectedType, operation }) {
  const user = await githubJson(fetchImpl, `${apiBaseUrl}/users/${encodeURIComponent(login)}`, apiVersion, token, operation);
  assert(Number.isInteger(user.id) && user.id > 0, `${operation} returned no immutable user ID`);
  assert(typeof user.login === 'string' && user.login.length > 0, `${operation} returned no login`);
  assert(user.type === expectedType, `${operation} expected GitHub type ${expectedType} but received ${user.type || '<missing>'}`);
  return { login: user.login, id: user.id, type: user.type };
}

export async function planTrustBootstrap({
  root,
  currentPolicy,
  repository = null,
  reviewerLogins,
  agentLogin = null,
  allowRebind = false,
  repositoryContext = null,
  fetchImpl = globalThis.fetch,
  token
}) {
  assert(token, 'Trust bootstrap requires a metadata token supplied through the selected environment variable');
  assert(Array.isArray(reviewerLogins) && reviewerLogins.length > 0, 'Trust bootstrap requires at least one human reviewer login');
  const context = repositoryContext || await readRepositoryContext(root);
  const targetRepository = repository || context.repository;
  assert(normalize(targetRepository) === normalize(context.repository),
    `Trust bootstrap target ${targetRepository} does not match actual repository ${context.repository}`);

  const apiBaseUrl = currentPolicy.github.apiBaseUrl;
  const apiVersion = currentPolicy.github.apiVersion;
  const repositoryMetadata = await githubJson(
    fetchImpl,
    `${apiBaseUrl}/repos/${targetRepository.split('/').map(encodeURIComponent).join('/')}`,
    apiVersion,
    token,
    'repository lookup'
  );
  assert(Number.isInteger(repositoryMetadata.id) && repositoryMetadata.id > 0, 'Repository lookup returned no immutable repository ID');
  assert(normalize(repositoryMetadata.full_name) === normalize(targetRepository), 'Repository lookup returned a different repository');

  const reviewers = [];
  for (const login of reviewerLogins) {
    reviewers.push(await resolveIdentity({
      apiBaseUrl,
      apiVersion,
      fetchImpl,
      login,
      token,
      expectedType: 'User',
      operation: `reviewer lookup for ${login}`
    }));
  }

  const inherited = normalize(currentPolicy.github.repository) !== normalize(targetRepository);
  let agentIdentity = inherited ? { kind: 'GitHubApp', login: null, id: null } : structuredClone(currentPolicy.github.agentIdentity);
  if (agentLogin) {
    const agent = await resolveIdentity({
      apiBaseUrl,
      apiVersion,
      fetchImpl,
      login: agentLogin,
      token,
      expectedType: 'Bot',
      operation: `agent lookup for ${agentLogin}`
    });
    agentIdentity = { kind: 'GitHubApp', login: agent.login, id: agent.id };
  }

  const bindingChanges =
    !inherited && (
      currentPolicy.github.repositoryId !== repositoryMetadata.id ||
      !sameReviewers(currentPolicy.github.reviewers, reviewers) ||
      normalize(currentPolicy.github.agentIdentity.login || '') !== normalize(agentIdentity.login || '') ||
      currentPolicy.github.agentIdentity.id !== agentIdentity.id
    );
  if (bindingChanges && !allowRebind) {
    throw new Error('Trust bootstrap would change an existing repository binding; repeat with explicit --rebind after human authorization');
  }

  const policy = {
    schemaVersion: 1,
    mode: 'bootstrap',
    manual: { enabled: true, allowedGates: ['specification'], bootstrapRunIds: [] },
    github: {
      enabled: false,
      apiBaseUrl,
      apiVersion,
      tokenEnv: currentPolicy.github.tokenEnv,
      repository: repositoryMetadata.full_name,
      repositoryId: repositoryMetadata.id,
      workflowFile: currentPolicy.github.workflowFile,
      trustedRef: currentPolicy.github.trustedRef,
      environments: structuredClone(currentPolicy.github.environments),
      reviewers,
      preventSelfReview: true,
      allowAdminBypass: false,
      agentIdentity
    }
  };
  validateTrustPolicyInvariants(policy);
  const codeowners = renderCodeowners(reviewers);
  assertCodeownersBinding(codeowners, reviewers);
  return {
    policy,
    codeowners,
    summary: {
      repository: policy.github.repository,
      repositoryId: policy.github.repositoryId,
      reviewers: reviewers.map(({ login, id }) => ({ login, id })),
      agentIdentity: { login: agentIdentity.login, id: agentIdentity.id },
      mode: policy.mode,
      githubEnabled: policy.github.enabled,
      inheritedBindingReplaced: inherited,
      requiresProtectedBranchReview: true
    }
  };
}

export async function applyTrustBootstrap(root, plan) {
  validateTrustPolicyInvariants(plan.policy);
  assertCodeownersBinding(plan.codeowners, plan.policy.github.reviewers);
  const targets = [
    { path: path.join(root, '.agentic/approval-providers.json'), content: `${JSON.stringify(plan.policy, null, 2)}\n` },
    { path: path.join(root, '.github/CODEOWNERS'), content: plan.codeowners }
  ];
  const transaction = randomUUID();
  const prepared = targets.map((target) => ({
    ...target,
    temporary: `${target.path}.${transaction}.tmp`,
    backup: `${target.path}.${transaction}.bak`,
    backedUp: false,
    installed: false
  }));

  try {
    for (const target of prepared) {
      await mkdir(path.dirname(target.path), { recursive: true });
      await writeFile(target.temporary, target.content, 'utf8');
    }
    for (const target of prepared) {
      try {
        await rename(target.path, target.backup);
        target.backedUp = true;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    for (const target of prepared) {
      await rename(target.temporary, target.path);
      target.installed = true;
    }
  } catch (error) {
    for (const target of [...prepared].reverse()) {
      if (target.installed) await rm(target.path, { force: true });
      if (target.backedUp) await rename(target.backup, target.path);
      await rm(target.temporary, { force: true });
    }
    throw new Error(`Trust bootstrap transaction rolled back: ${error.message}`);
  }

  for (const target of prepared) {
    if (target.backedUp) await rm(target.backup, { force: true });
    await rm(target.temporary, { force: true });
  }
  return plan.summary;
}

export async function readTrustFiles(root) {
  const [policy, codeowners] = await Promise.all([
    readFile(path.join(root, '.agentic/approval-providers.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, '.github/CODEOWNERS'), 'utf8')
  ]);
  return { policy, codeowners };
}
