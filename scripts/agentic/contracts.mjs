import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const META_SCHEMA_ID = 'https://json-schema.org/draft/2020-12/schema';
const DEFAULT_IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.expo',
  '.turbo'
]);
const IGNORED_PREFIXES = ['.agentic/runs/', '.agentic/telemetry/'];

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function globToRegExp(glob) {
  let pattern = '^';
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index];
    if (character === '*') {
      if (glob[index + 1] === '*') {
        index += 1;
        if (glob[index + 1] === '/') {
          index += 1;
          pattern += '(?:.*/)?';
        } else {
          pattern += '.*';
        }
      } else {
        pattern += '[^/]*';
      }
      continue;
    }
    if (character === '?') {
      pattern += '[^/]';
      continue;
    }
    pattern += /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character;
  }
  return new RegExp(`${pattern}$`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function discoverControlledJson(root, relative = '') {
  const absolute = path.join(root, relative);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = toPosix(path.join(relative, entry.name));
    if (entry.isDirectory()) {
      if (DEFAULT_IGNORED_DIRECTORIES.has(entry.name)) continue;
      if (IGNORED_PREFIXES.some((prefix) => `${child}/`.startsWith(prefix))) continue;
      files.push(...await discoverControlledJson(root, child));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(child);
    }
  }
  return files.sort();
}

function safeErrors(errors = []) {
  return errors.map((error) => ({
    instancePath: error.instancePath || '/',
    schemaPath: error.schemaPath,
    keyword: error.keyword,
    message: error.message || 'validation failed'
  }));
}

function formatErrors(artifact, schemaId, errors) {
  return safeErrors(errors).map((error) =>
    `${artifact}: schema=${schemaId} instancePath=${error.instancePath} keyword=${error.keyword} ${error.message}`
  );
}

function assertActiveExclusion(entry, now) {
  if (!entry.owner || !entry.reason || !entry.expiresAt) {
    throw new Error(`Exclusion ${entry.id} must declare owner, reason, and expiresAt`);
  }
  if (Date.parse(entry.expiresAt) <= now) {
    throw new Error(`Exclusion ${entry.id} expired at ${entry.expiresAt}`);
  }
}

function schemaOwnersFor(registry, relativePath) {
  const normalized = toPosix(relativePath);
  return registry.entries.filter((entry) => globToRegExp(entry.glob).test(normalized));
}

export async function createContractValidator(root = process.cwd(), { now = Date.now() } = {}) {
  const registryPath = path.join(root, '.agentic/schema-registry.json');
  const registry = await readJson(registryPath);
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    validateFormats: true,
    messages: true
  });
  addFormats(ajv);

  const schemaDirectory = path.join(root, '.agentic/schemas');
  const schemaFiles = (await readdir(schemaDirectory)).filter((name) => name.endsWith('.schema.json')).sort();
  const schemas = new Map();
  for (const file of schemaFiles) {
    const absolute = path.join(schemaDirectory, file);
    const schema = await readJson(absolute);
    const valid = ajv.validateSchema(schema);
    if (!valid) {
      throw new Error(formatErrors(toPosix(path.relative(root, absolute)), META_SCHEMA_ID, ajv.errors).join('\n'));
    }
    schemas.set(schema.$id, { file: toPosix(path.relative(root, absolute)), schema });
  }
  for (const { schema } of schemas.values()) ajv.addSchema(schema);

  const registrySchemaId = 'https://mobilka.local/schemas/schema-registry.schema.json';
  const validateRegistry = ajv.getSchema(registrySchemaId);
  if (!validateRegistry) throw new Error(`Missing compiled schema ${registrySchemaId}`);
  if (!validateRegistry(registry)) {
    throw new Error(formatErrors('.agentic/schema-registry.json', registrySchemaId, validateRegistry.errors).join('\n'));
  }

  function validateValue(schemaId, value, artifact = '<memory>') {
    if (schemaId === META_SCHEMA_ID) {
      const valid = ajv.validateSchema(value);
      return { valid, errors: valid ? [] : formatErrors(artifact, schemaId, ajv.errors) };
    }
    const validate = ajv.getSchema(schemaId);
    if (!validate) return { valid: false, errors: [`${artifact}: schema=${schemaId} is not registered`] };
    const valid = validate(value);
    return { valid, errors: valid ? [] : formatErrors(artifact, schemaId, validate.errors) };
  }

  function assertValue(schemaId, value, artifact = '<memory>') {
    const result = validateValue(schemaId, value, artifact);
    if (!result.valid) throw new Error(result.errors.join('\n'));
    return value;
  }

  async function validateArtifact(relativePath) {
    const normalized = toPosix(relativePath);
    const matching = schemaOwnersFor(registry, normalized);
    if (matching.length === 0) return { valid: false, errors: [`${normalized}: no schema owner`] };
    if (matching.length > 1) {
      return { valid: false, errors: [`${normalized}: multiple schema owners: ${matching.map((entry) => entry.id).join(', ')}`] };
    }
    const [entry] = matching;
    if (entry.kind === 'exclusion') {
      try {
        assertActiveExclusion(entry, now);
        return { valid: true, errors: [], owner: entry.id, excluded: true };
      } catch (error) {
        return { valid: false, errors: [`${normalized}: ${error.message}`], owner: entry.id };
      }
    }
    try {
      const value = await readJson(path.join(root, normalized));
      const result = validateValue(entry.schemaId, value, normalized);
      return { ...result, owner: entry.id, schemaId: entry.schemaId };
    } catch (error) {
      return { valid: false, errors: [`${normalized}: JSON parse failed: ${error.message}`], owner: entry.id };
    }
  }

  async function validateRepository() {
    const files = await discoverControlledJson(root);
    const errors = [];
    const ownership = [];
    for (const file of files) {
      const result = await validateArtifact(file);
      ownership.push({ artifact: file, owner: result.owner || null, schemaId: result.schemaId || null, excluded: result.excluded || false });
      if (!result.valid) errors.push(...result.errors);
    }

    const negativeFixtureSchemaId = 'https://mobilka.local/schemas/negative-fixture.schema.json';
    for (const fixturePath of registry.negativeFixtures || []) {
      const normalized = toPosix(fixturePath);
      let fixture;
      try {
        fixture = await readJson(path.join(root, normalized));
      } catch (error) {
        errors.push(`${normalized}: JSON parse failed: ${error.message}`);
        continue;
      }
      const wrapper = validateValue(negativeFixtureSchemaId, fixture, normalized);
      if (!wrapper.valid) {
        errors.push(...wrapper.errors);
        continue;
      }
      const negative = validateValue(fixture.schemaId, fixture.value, `${normalized}#value`);
      if (negative.valid) {
        errors.push(`${normalized}: negative fixture unexpectedly passed schema ${fixture.schemaId}`);
        continue;
      }
      const rawErrors = (() => {
        const validate = ajv.getSchema(fixture.schemaId);
        validate(fixture.value);
        return safeErrors(validate.errors);
      })();
      const matched = rawErrors.some((error) =>
        error.keyword === fixture.expected.keyword && error.instancePath === fixture.expected.instancePath
      );
      if (!matched) {
        errors.push(`${normalized}: expected keyword=${fixture.expected.keyword} instancePath=${fixture.expected.instancePath}; got ${JSON.stringify(rawErrors)}`);
      }
    }

    return { valid: errors.length === 0, errors, ownership, schemas: schemas.size, artifacts: files.length };
  }

  return { ajv, registry, validateValue, assertValue, validateArtifact, validateRepository };
}

export { discoverControlledJson, globToRegExp, safeErrors, schemaOwnersFor };
