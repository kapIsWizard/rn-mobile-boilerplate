import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadJson } from './lib.mjs';
import { createContractValidator } from './contracts.mjs';

const root = process.cwd();
const errors = [];
const requiredJson = [
  '.agentic/config.json',
  '.agentic/capabilities.json',
  '.agentic/environments.json',
  '.agentic/approval-providers.json',
  '.agentic/policies/risk.json',
  '.agentic/policies/state-machine.json',
  '.agentic/policies/guardrails.json'
];

const loaded = new Map();

try {
  const contracts = await createContractValidator(root);
  const report = await contracts.validateRepository();
  errors.push(...report.errors);
} catch (error) {
  errors.push(`contract validator startup: ${error.message}`);
}

for (const relative of requiredJson) {
  try {
    loaded.set(relative, await loadJson(path.join(root, relative)));
  } catch (error) {
    errors.push(`${relative}: ${error.message}`);
  }
}

const config = loaded.get('.agentic/config.json');
const stateMachine = loaded.get('.agentic/policies/state-machine.json');
const approvalProviders = loaded.get('.agentic/approval-providers.json');
if (config && stateMachine) {
  const states = new Set([...Object.keys(stateMachine.transitions), ...stateMachine.terminalStates]);
  const digests = new Set(['spec', 'environment', 'evidence', 'releaseArtifact']);
  if (!states.has(stateMachine.initialState)) errors.push('state machine: initial state is not declared');
  for (const [from, rules] of Object.entries(stateMachine.transitions)) {
    const destinations = new Set();
    for (const rule of rules) {
      if (!states.has(rule.to)) errors.push(`state machine: ${from} points to unknown state ${rule.to}`);
      if (destinations.has(rule.to)) errors.push(`state machine: duplicate ${from} -> ${rule.to} transition`);
      destinations.add(rule.to);
      if (rule.requiresDigest && !digests.has(rule.requiresDigest)) errors.push(`state machine: unknown digest ${rule.requiresDigest}`);
      if (rule.requiresApproval && !config.humanGates.includes(rule.requiresApproval)) errors.push(`state machine: unknown approval ${rule.requiresApproval}`);
      for (const digest of rule.invalidateDigests || []) {
        if (!digests.has(digest)) errors.push(`state machine: unknown invalidated digest ${digest}`);
      }
      for (const gate of rule.invalidateApprovals || []) {
        if (!config.humanGates.includes(gate)) errors.push(`state machine: unknown invalidated approval ${gate}`);
      }
    }
  }
  if (!config.monitoring || config.monitoring.maxSilentMinutes <= 0 || config.monitoring.maxActiveRunsPerObjective <= 0) {
    errors.push('config: monitoring limits must be positive');
  }
}

if (approvalProviders) {
  if (approvalProviders.manual.allowedGates.some((gate) => gate !== 'specification')) {
    errors.push('approval providers: manual adapter may authorize only the bootstrap specification gate');
  }
  if (approvalProviders.mode === 'enforced' && approvalProviders.manual.enabled) {
    errors.push('approval providers: enforced mode must disable manual approval');
  }
  if (approvalProviders.github.agentIdentity.login === 'kapIsWizard' || approvalProviders.github.agentIdentity.id === 96981818) {
    errors.push('approval providers: agent identity must be distinct from the human reviewer');
  }
}

const workflowsRoot = path.join(root, '.agentic/workflows');
try {
  for (const file of await readdir(workflowsRoot)) {
    if (!file.endsWith('.json')) continue;
    try {
      const workflow = await loadJson(path.join(workflowsRoot, file));
      const expectedName = file.slice(0, -5);
      if (workflow.name !== expectedName) errors.push(`${file}: workflow name does not match filename`);
      for (const gate of workflow.humanGates || []) {
        if (!config?.humanGates.includes(gate)) errors.push(`${file}: unknown human gate ${gate}`);
      }
      if (!Array.isArray(workflow.stages) || workflow.stages.length === 0) errors.push(`${file}: stages must not be empty`);
    } catch (error) {
      errors.push(`${file}: ${error.message}`);
    }
  }
} catch (error) {
  errors.push(`workflows root: ${error.message}`);
}

try {
  const contract = await loadJson(path.join(root, 'docs/requirements/phase-1-critical-spike/visual-contract.json'));
  const reference = await readFile(path.join(root, 'docs/requirements/phase-1-critical-spike', contract.reference), 'utf8');
  for (const screen of contract.screens) {
    if (!reference.includes(`id="${screen.referenceRegion}"`)) {
      errors.push(`visual contract: missing SVG region ${screen.referenceRegion}`);
    }
  }
  const gherkin = await readFile(path.join(root, 'docs/requirements/phase-1-critical-spike/private-notes.feature'), 'utf8');
  for (const requirement of ['REQ-NOTE-001', 'REQ-NOTE-002', 'REQ-NOTE-003', 'REQ-NOTE-004', 'REQ-NOTE-005', 'REQ-NOTE-006']) {
    if (!gherkin.includes(`@requirement:${requirement}`)) errors.push(`Gherkin: missing ${requirement}`);
  }
  const dataProtection = await loadJson(path.join(root, 'docs/requirements/phase-1-critical-spike/data-protection-contract.json'));
  if (dataProtection.status !== 'proposed') errors.push('phase 1 data protection: H1 contract must be proposed, not approved or blocked');
  if (!dataProtection.decision?.profile) errors.push('phase 1 data protection: a protection profile must be proposed');
  if (dataProtection.decision?.requiresHumanConfirmation !== true) errors.push('phase 1 data protection: H1 confirmation must remain required');
  if (dataProtection.keyBoundary?.valuesRecorded !== false || dataProtection.keyBoundary?.productionKeyAccess !== false || dataProtection.keyBoundary?.metadataOnly !== true) {
    errors.push('phase 1 data protection: raw or production key access is forbidden');
  }
} catch (error) {
  errors.push(`phase 1 specification pack: ${error.message}`);
}

try {
  const environmentTemplate = await loadJson(path.join(root, 'environment/templates/readiness.json'));
  if (environmentTemplate.secretBoundary.valuesRecorded !== false) errors.push('environment template: secret values must never be recorded');
  if (environmentTemplate.secretBoundary.productionAccess !== false) errors.push('environment template: production access must default to false');
  if (environmentTemplate.keyBoundary.valuesRecorded !== false) errors.push('environment template: cryptographic key values must never be recorded');
  if (environmentTemplate.keyBoundary.productionKeyAccess !== false) errors.push('environment template: production key access must default to false');
  if (environmentTemplate.status !== 'blocked') errors.push('environment template: incomplete template must default to blocked');
} catch (error) {
  errors.push(`environment readiness template: ${error.message}`);
}

try {
  const dataProtectionTemplate = await loadJson(path.join(root, 'security/templates/data-protection-contract.json'));
  if (dataProtectionTemplate.status !== 'blocked') errors.push('data protection template: incomplete template must default to blocked');
  if (dataProtectionTemplate.decision.profile !== null) errors.push('data protection template: profile must not be preselected');
  if (dataProtectionTemplate.decision.requiresHumanConfirmation !== true) errors.push('data protection template: H1 confirmation must be required');
  if (dataProtectionTemplate.keyBoundary.valuesRecorded !== false || dataProtectionTemplate.keyBoundary.productionKeyAccess !== false || dataProtectionTemplate.keyBoundary.metadataOnly !== true) {
    errors.push('data protection template: raw or production key access is forbidden');
  }
} catch (error) {
  errors.push(`data protection template: ${error.message}`);
}

const skillsRoot = path.join(root, '.agents/skills');
try {
  for (const name of await readdir(skillsRoot)) {
    const skillPath = path.join(skillsRoot, name, 'SKILL.md');
    const metadataPath = path.join(skillsRoot, name, 'agents/openai.yaml');
    try {
      const content = await readFile(skillPath, 'utf8');
      if (!content.startsWith(`---\nname: ${name}\n`)) errors.push(`${skillPath}: invalid name or frontmatter`);
      if (content.includes('[TODO')) errors.push(`${skillPath}: unresolved TODO`);
      const metadata = await readFile(metadataPath, 'utf8');
      if (!metadata.includes(`$${name}`)) errors.push(`${metadataPath}: default_prompt must mention $${name}`);
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
    }
  }
} catch (error) {
  errors.push(`skills root: ${error.message}`);
}

try {
  const gateWorkflow = await readFile(path.join(root, '.github/workflows/human-gate.yml'), 'utf8');
  for (const expected of [
    'workflow_dispatch:',
    'run-name: human-gate:${{ inputs.gate }}:${{ inputs.request_id }}:${{ inputs.request_digest }}',
    'name: h1-specification',
    'name: h2-acceptance',
    'name: h3-release',
    'permissions:\n  contents: read'
  ]) {
    if (!gateWorkflow.includes(expected)) errors.push(`human gate workflow: missing trusted control ${expected}`);
  }
  for (const forbidden of ['pull_request_target:', 'actions/checkout', 'permissions: write-all']) {
    if (gateWorkflow.includes(forbidden)) errors.push(`human gate workflow: forbidden trust expansion ${forbidden}`);
  }
} catch (error) {
  errors.push(`human gate workflow: ${error.message}`);
}

try {
  const ciWorkflow = await readFile(path.join(root, '.github/workflows/agentic-foundation.yml'), 'utf8');
  if (!ciWorkflow.includes('run: npm ci')) errors.push('agentic CI: dependency installation must use npm ci');
  if (!ciWorkflow.includes('run: npm run agentic:check')) errors.push('agentic CI: required check must run agentic:check');
} catch (error) {
  errors.push(`agentic CI: ${error.message}`);
}

try {
  const codeowners = await readFile(path.join(root, '.github/CODEOWNERS'), 'utf8');
  for (const protectedPath of ['/.github/', '/.agentic/', '/scripts/agentic/', '/package-lock.json']) {
    if (!codeowners.includes(protectedPath)) errors.push(`CODEOWNERS: missing protected path ${protectedPath}`);
  }
} catch (error) {
  errors.push(`CODEOWNERS: ${error.message}`);
}

for (const relative of ['AGENTS.md', 'package.json', 'package-lock.json', 'scripts/agentic/cli.mjs', 'docs/operations/github-human-gates.md']) {
  try {
    await access(path.join(root, relative));
  } catch {
    errors.push(`${relative}: missing`);
  }
}

if (errors.length) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('Agentic foundation validation passed.\n');
}
