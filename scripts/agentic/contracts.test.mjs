import assert from 'node:assert/strict';
import test from 'node:test';
import { createContractValidator, safeErrors, schemaOwnersFor } from './contracts.mjs';

test('strict Draft 2020-12 registry validates every controlled repository JSON artifact', async () => {
  const validator = await createContractValidator();
  const report = await validator.validateRepository();
  assert.equal(report.valid, true, report.errors.join('\n'));
  assert.ok(report.schemas >= 27);
  assert.ok(report.artifacts >= 66);
  assert.equal(report.ownership.every((entry) => entry.owner), true);
});

test('zero and multiple schema owners are explicit coverage failures', () => {
  const registry = {
    entries: [
      { id: 'first', glob: 'config/*.json' },
      { id: 'second', glob: 'config/special.json' }
    ]
  };
  assert.deepEqual(schemaOwnersFor(registry, 'unowned.json'), []);
  assert.deepEqual(schemaOwnersFor(registry, 'config/special.json').map((entry) => entry.id), ['first', 'second']);
});

test('schema diagnostics expose paths and keywords but never rejected data values', () => {
  const errors = safeErrors([{
    instancePath: '/token',
    schemaPath: '#/properties/token/type',
    keyword: 'type',
    message: 'must be string',
    data: 'top-secret-value'
  }]);
  assert.deepEqual(errors, [{
    instancePath: '/token',
    schemaPath: '#/properties/token/type',
    keyword: 'type',
    message: 'must be string'
  }]);
  assert.equal(JSON.stringify(errors).includes('top-secret-value'), false);
});

test('focused negative fixtures reject the documented instance path and keyword', async () => {
  const validator = await createContractValidator();
  for (const fixturePath of validator.registry.negativeFixtures) {
    const fixture = JSON.parse(await (await import('node:fs/promises')).readFile(fixturePath, 'utf8'));
    const result = validator.validateValue(fixture.schemaId, fixture.value, fixturePath);
    assert.equal(result.valid, false, `${fixturePath} unexpectedly passed`);
    assert.equal(result.errors.some((error) =>
      error.includes(`instancePath=${fixture.expected.instancePath}`) && error.includes(`keyword=${fixture.expected.keyword}`)
    ), true, `${fixturePath} did not fail at the documented location`);
  }
});
