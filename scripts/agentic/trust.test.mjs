import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createContractValidator } from './contracts.mjs';
import { loadKernel } from './lib.mjs';
import {
  applyTrustBootstrap,
  assertCodeownersBinding,
  assertRepositoryBinding,
  planTrustBootstrap,
  readTrustFiles,
  renderCodeowners,
  repositoryFromRemote,
  validateTrustPolicyInvariants
} from './trust.mjs';

function metadataFetch({ repository, repositoryId, users = {} }) {
  return async (url) => {
    const value = String(url);
    if (value.includes('/repos/')) {
      return { ok: true, status: 200, json: async () => ({ id: repositoryId, full_name: repository }) };
    }
    const login = decodeURIComponent(value.split('/users/')[1]);
    const user = users[login];
    if (!user) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => user };
  };
}

async function installationPlan(currentPolicy, {
  repository,
  repositoryId,
  reviewer,
  reviewerId,
  agent,
  agentId
}) {
  return planTrustBootstrap({
    root: process.cwd(),
    currentPolicy,
    repository,
    reviewerLogins: [reviewer],
    agentLogin: agent,
    repositoryContext: { repository, repositoryId, source: 'test' },
    token: 'metadata-token-for-test',
    fetchImpl: metadataFetch({
      repository,
      repositoryId,
      users: {
        [reviewer]: { login: reviewer, id: reviewerId, type: 'User' },
        [agent]: { login: agent, id: agentId, type: 'Bot' }
      }
    })
  });
}

test('generic trust schema accepts two independent repository and reviewer installations', async () => {
  const kernel = await loadKernel();
  const first = await installationPlan(kernel.approvalProviders, {
    repository: 'example-one/mobile-one',
    repositoryId: 1001,
    reviewer: 'alice-owner',
    reviewerId: 2001,
    agent: 'delivery-one[bot]',
    agentId: 3001
  });
  const second = await installationPlan(kernel.approvalProviders, {
    repository: 'example-two/mobile-two',
    repositoryId: 1002,
    reviewer: 'bob-owner',
    reviewerId: 2002,
    agent: 'delivery-two[bot]',
    agentId: 3002
  });
  const validator = await createContractValidator();
  const schemaId = 'https://mobilka.local/schemas/approval-provider-config.schema.json';
  assert.equal(validator.validateValue(schemaId, first.policy).valid, true);
  assert.equal(validator.validateValue(schemaId, second.policy).valid, true);
  assert.notEqual(first.policy.github.repository, second.policy.github.repository);
  assert.notEqual(first.policy.github.reviewers[0].id, second.policy.github.reviewers[0].id);
  assert.equal(first.codeowners.includes('@bob-owner'), false);
  assert.equal(second.codeowners.includes('@alice-owner'), false);
});

test('reusable trust source contains no constants from the current deployment binding', async () => {
  const kernel = await loadKernel();
  const deploymentConstants = [
    kernel.approvalProviders.github.repository,
    String(kernel.approvalProviders.github.repositoryId),
    ...kernel.approvalProviders.github.reviewers.flatMap((reviewer) => [reviewer.login, String(reviewer.id)])
  ];
  const reusableFiles = [
    '.agentic/schemas/approval-provider-config.schema.json',
    'scripts/agentic/approvals.mjs',
    'scripts/agentic/approvals.test.mjs',
    'scripts/agentic/trust.mjs',
    'scripts/agentic/trust.test.mjs',
    'scripts/agentic/validate.mjs'
  ];
  for (const relative of reusableFiles) {
    const content = await readFile(relative, 'utf8');
    for (const deploymentConstant of deploymentConstants) {
      assert.equal(content.includes(deploymentConstant), false, `${relative} contains deployment constant ${deploymentConstant}`);
    }
  }
});

test('GitHub origin formats resolve to one repository binding', () => {
  assert.equal(repositoryFromRemote('git@github.com:example/mobile.git'), 'example/mobile');
  assert.equal(repositoryFromRemote('https://github.com/example/mobile.git'), 'example/mobile');
  assert.equal(repositoryFromRemote('ssh://git@github.com/example/mobile.git'), 'example/mobile');
  assert.throws(() => repositoryFromRemote('https://gitlab.com/example/mobile.git'), /only github.com/);
});

test('repository name and immutable ID mismatches fail closed', async () => {
  const kernel = await loadKernel();
  assert.throws(
    () => assertRepositoryBinding(kernel.approvalProviders, { repository: 'other/project', repositoryId: null }),
    /Repository binding mismatch/
  );
  assert.throws(
    () => assertRepositoryBinding(kernel.approvalProviders, {
      repository: kernel.approvalProviders.github.repository,
      repositoryId: kernel.approvalProviders.github.repositoryId + 1
    }),
    /Repository ID binding mismatch/
  );
});

test('bootstrap rejects a target that differs from actual origin before metadata lookup', async () => {
  const kernel = await loadKernel();
  let fetched = false;
  await assert.rejects(() => planTrustBootstrap({
    root: process.cwd(),
    currentPolicy: kernel.approvalProviders,
    repository: 'other/project',
    reviewerLogins: ['owner'],
    repositoryContext: { repository: 'actual/project', repositoryId: 1, source: 'test' },
    token: 'metadata-token-for-test',
    fetchImpl: async () => { fetched = true; throw new Error('must not fetch'); }
  }), /does not match actual repository/);
  assert.equal(fetched, false);
});

test('bootstrap rejects duplicate, bot, conflicted, and unavailable reviewer evidence', async () => {
  const kernel = await loadKernel();
  const repository = 'example/mobile';
  const repositoryContext = { repository, repositoryId: 51, source: 'test' };
  const common = {
    root: process.cwd(),
    currentPolicy: kernel.approvalProviders,
    repository,
    repositoryContext,
    token: 'metadata-token-for-test'
  };

  await assert.rejects(() => planTrustBootstrap({
    ...common,
    reviewerLogins: ['alice', 'bob'],
    fetchImpl: metadataFetch({
      repository,
      repositoryId: 51,
      users: {
        alice: { login: 'alice', id: 61, type: 'User' },
        bob: { login: 'bob', id: 61, type: 'User' }
      }
    })
  }), /duplicate reviewer immutable ID/);

  await assert.rejects(() => planTrustBootstrap({
    ...common,
    reviewerLogins: ['automation[bot]'],
    fetchImpl: metadataFetch({
      repository,
      repositoryId: 51,
      users: { 'automation[bot]': { login: 'automation[bot]', id: 62, type: 'Bot' } }
    })
  }), /expected GitHub type User/);

  await assert.rejects(() => planTrustBootstrap({
    ...common,
    reviewerLogins: ['alice'],
    agentLogin: 'delivery[bot]',
    fetchImpl: metadataFetch({
      repository,
      repositoryId: 51,
      users: {
        alice: { login: 'alice', id: 63, type: 'User' },
        'delivery[bot]': { login: 'delivery[bot]', id: 63, type: 'Bot' }
      }
    })
  }), /agent identity must be distinct/);

  await assert.rejects(() => planTrustBootstrap({
    ...common,
    reviewerLogins: ['alice'],
    fetchImpl: async () => { throw new Error('network unavailable'); }
  }), /metadata unavailable/);
});

test('changing an existing binding requires explicit rebind authority', async () => {
  const kernel = await loadKernel();
  const repository = kernel.approvalProviders.github.repository;
  const context = { repository, repositoryId: kernel.approvalProviders.github.repositoryId, source: 'test' };
  const reviewer = 'replacement-owner';
  const fetchImpl = metadataFetch({
    repository,
    repositoryId: kernel.approvalProviders.github.repositoryId,
    users: { [reviewer]: { login: reviewer, id: 7101, type: 'User' } }
  });
  await assert.rejects(() => planTrustBootstrap({
    root: process.cwd(),
    currentPolicy: kernel.approvalProviders,
    repository,
    reviewerLogins: [reviewer],
    repositoryContext: context,
    token: 'metadata-token-for-test',
    fetchImpl
  }), /explicit --rebind/);
  const plan = await planTrustBootstrap({
    root: process.cwd(),
    currentPolicy: kernel.approvalProviders,
    repository,
    reviewerLogins: [reviewer],
    repositoryContext: context,
    token: 'metadata-token-for-test',
    fetchImpl,
    allowRebind: true
  });
  assert.equal(plan.policy.github.reviewers[0].login, reviewer);
  assert.deepEqual(plan.policy.manual.bootstrapRunIds, []);
  assert.equal(plan.policy.github.enabled, false);
});

test('validated bootstrap applies policy and CODEOWNERS together in a fresh project', async () => {
  const kernel = await loadKernel();
  const plan = await installationPlan(kernel.approvalProviders, {
    repository: 'fresh/mobile',
    repositoryId: 8101,
    reviewer: 'fresh-owner',
    reviewerId: 8201,
    agent: 'fresh-delivery[bot]',
    agentId: 8301
  });
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'mobilka-trust-bootstrap-'));
  await mkdir(path.join(temporary, '.agentic'), { recursive: true });
  await mkdir(path.join(temporary, '.github'), { recursive: true });
  await writeFile(path.join(temporary, '.agentic/approval-providers.json'), '{}\n');
  await writeFile(path.join(temporary, '.github/CODEOWNERS'), '* @inherited-owner\n');
  await applyTrustBootstrap(temporary, plan);
  const written = await readTrustFiles(temporary);
  assert.deepEqual(written.policy, plan.policy);
  assert.equal(written.codeowners, renderCodeowners(plan.policy.github.reviewers));
  assert.equal(written.codeowners.includes('@inherited-owner'), false);
  assertCodeownersBinding(written.codeowners, plan.policy.github.reviewers);
  validateTrustPolicyInvariants(written.policy);
});
