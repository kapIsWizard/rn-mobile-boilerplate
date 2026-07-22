#!/usr/bin/env node
import path from 'node:path';
import {
  approveRun,
  auditRun,
  initRun,
  loadKernel,
  migrateRunWorkflow,
  monitorRuns,
  recordAttempt,
  recordFailure,
  recordGuardrailViolation,
  resumeRun,
  setRunDigest,
  transitionRun
} from './lib.mjs';
import { requestGithubApproval, verifyGithubApproval } from './approvals.mjs';

function parseArguments(values) {
  const positional = [];
  const options = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) {
      positional.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = values[index + 1];
    options[key] = next && !next.startsWith('--') ? values[++index] : true;
  }
  return { positional, options };
}

function required(value, message) {
  if (!value || value === true) throw new Error(message);
  return value;
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

const [command = 'help', ...rest] = process.argv.slice(2);
const { positional, options } = parseArguments(rest);
const kernel = await loadKernel();

try {
  if (command === 'init') {
    const result = await initRun(kernel, {
      name: required(options.name, '--name is required'),
      risk: options.risk || kernel.config.defaultRisk,
      workflow: options.workflow || 'develop-feature'
    });
    print({ runDir: path.relative(process.cwd(), result.runDir), state: result.state });
  } else if (command === 'digest') {
    const runDir = required(positional[0], 'run directory is required');
    const digest = await setRunDigest(kernel, runDir, required(options.kind, '--kind is required'), required(options.path, '--path is required'));
    print({ digest });
  } else if (command === 'approve') {
    const approval = await approveRun(kernel, required(positional[0], 'run directory is required'), required(options.gate, '--gate is required'), required(options.by, '--by is required'));
    print(approval);
  } else if (command === 'transition') {
    const role = options.role || 'orchestrator';
    const state = await transitionRun(kernel, required(positional[0], 'run directory is required'), required(options.to, '--to is required'), role, options.actor || role);
    print(state);
  } else if (command === 'workflow') {
    const state = await migrateRunWorkflow(
      kernel,
      required(positional[0], 'run directory is required'),
      required(options.to, '--to is required'),
      options.actor || 'orchestrator'
    );
    print(state);
  } else if (command === 'request-approval') {
    const result = await requestGithubApproval(kernel, required(positional[0], 'run directory is required'), {
      gate: required(options.gate, '--gate is required'),
      ttlMinutes: options['ttl-minutes'] ? Number(options['ttl-minutes']) : 30
    });
    print({
      requestPath: path.relative(process.cwd(), result.requestPath),
      request: result.request,
      workflowRunId: result.workflowRunId,
      workflowRunUrl: result.workflowRunUrl
    });
  } else if (command === 'verify-approval') {
    const approval = await verifyGithubApproval(kernel, required(positional[0], 'run directory is required'), {
      requestPath: required(options.request, '--request is required'),
      workflowRunId: Number(required(options['workflow-run-id'], '--workflow-run-id is required'))
    });
    print(approval);
  } else if (command === 'failure') {
    const state = await recordFailure(kernel, required(positional[0], 'run directory is required'), {
      failureClass: required(options.class, '--class is required'),
      signature: required(options.signature, '--signature is required'),
      evidence: options.evidence ? String(options.evidence).split(',').filter(Boolean) : [],
      role: options.role || 'verifier',
      actor: options.actor || options.role || 'verifier'
    });
    print(state);
  } else if (command === 'attempt') {
    const state = await recordAttempt(kernel, required(positional[0], 'run directory is required'), {
      bucket: required(options.bucket, '--bucket is required'),
      role: required(options.role, '--role is required'),
      actor: options.actor || options.role,
      evidence: options.evidence ? String(options.evidence).split(',').filter(Boolean) : []
    });
    print(state);
  } else if (command === 'violation') {
    const state = await recordGuardrailViolation(kernel, required(positional[0], 'run directory is required'), {
      signal: required(options.signal, '--signal is required'),
      role: required(options.role, '--role is required'),
      actor: options.actor || options.role,
      evidence: options.evidence ? String(options.evidence).split(',').filter(Boolean) : []
    });
    print(state);
  } else if (command === 'resume') {
    const state = await resumeRun(kernel, required(positional[0], 'run directory is required'), {
      approvedBy: required(options.by, '--by is required'),
      reason: required(options.reason, '--reason is required'),
      budgetBucket: options.budget || null,
      budgetLimit: options.limit ? Number(options.limit) : null
    });
    print(state);
  } else if (command === 'audit') {
    const runDir = required(positional[0], 'run directory is required');
    const report = await auditRun(kernel, runDir);
    print(report);
    if (report.status !== 'clean') process.exitCode = 2;
  } else if (command === 'monitor') {
    const report = await monitorRuns(kernel);
    print(report);
    if (report.status !== 'clean') process.exitCode = 2;
  } else {
    process.stdout.write(`Usage:\n  agentic init --name <name> [--risk fast|standard|critical] [--workflow name]\n  agentic digest <run-dir> --kind spec|environment|evidence|releaseArtifact --path <path>\n  agentic approve <run-dir> --gate specification --by <human>\n  agentic workflow <run-dir> --to <workflow> [--actor agent-id]\n  agentic request-approval <run-dir> --gate specification|acceptance|release [--ttl-minutes 30]\n  agentic verify-approval <run-dir> --request <path> --workflow-run-id <id>\n  agentic transition <run-dir> --to <state> [--actor agent-id]\n  agentic attempt <run-dir> --bucket <bucket> --role <role> [--actor agent-id] [--evidence a,b]\n  agentic failure <run-dir> --class <class> --signature <hash> [--actor agent-id] [--evidence a,b]\n  agentic violation <run-dir> --signal <forbidden-signal> --role <role> --evidence <paths> [--actor agent-id]\n  agentic resume <run-dir> --by <human> --reason <reason> [--budget <bucket> --limit <n>]\n  agentic audit <run-dir>\n  agentic monitor\n`);
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
