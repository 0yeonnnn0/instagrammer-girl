'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const SUPPORTED_PROVIDERS = ['claude', 'codex'];
const ROOT = path.join(__dirname, '..');

function normalizeProvider(provider) {
  const value = String(provider || process.env.AI_PROVIDER || 'claude').trim().toLowerCase();
  return SUPPORTED_PROVIDERS.includes(value) ? value : 'claude';
}

function defaultModelFor(provider) {
  return provider === 'codex' ? 'gpt-5.4' : 'sonnet';
}

function resolveProviderConfig(options = {}) {
  const provider = normalizeProvider(options.provider);
  const model = options.model || process.env.AI_MODEL || defaultModelFor(provider);
  return { provider, model };
}

function buildPrompt(provider, prompt, options = {}) {
  if (provider !== 'codex') return prompt;

  const cwd = options.cwd || ROOT;
  return [
    'You are running inside the instagrammer-girl repository.',
    `Working directory: ${cwd}`,
    'Primary instruction source: read and follow CODEX.md in the repository root before making changes or running the workflow.',
    'Execute the requested end-to-end pipeline yourself inside this repository instead of only returning a plan.',
    'If the request says upload, perform the repository upload step only after the generation artifacts are ready.',
    'Keep outputs inside the repository conventions (workspace/, output/, logs/).',
    '',
    'User request:',
    prompt,
  ].join('\n');
}

function buildCommand(provider, prompt, options = {}) {
  const { model } = resolveProviderConfig({ provider, model: options.model });

  if (provider === 'codex') {
    const args = ['exec', '--full-auto', '--skip-git-repo-check'];
    if (model) args.push('-m', model);
    if (options.cwd) args.push('-C', options.cwd);
    args.push(prompt);
    return { command: 'codex', args };
  }

  const args = ['-p'];
  if (model) args.push('--model', model);
  if (options.skipPermissions) args.push('--dangerously-skip-permissions');
  if (options.budgetUsd != null) args.push('--max-budget-usd', String(options.budgetUsd));
  args.push(prompt);
  return { command: 'claude', args };
}

function checkProviderAvailable(options = {}) {
  const { provider } = resolveProviderConfig(options);
  const command = provider === 'codex' ? 'codex' : 'claude';

  try {
    execFileSync(command, ['--version'], {
      cwd: options.cwd || ROOT,
      encoding: 'utf8',
      timeout: 15_000,
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024,
    });
    return { ok: true, provider };
  } catch (error) {
    const detail = (error.stdout || error.stderr || error.message || '').toString().trim();
    return {
      ok: false,
      provider,
      message: detail || `${command} is not available`,
    };
  }
}

function runPrompt(prompt, options = {}) {
  const { provider, model } = resolveProviderConfig(options);
  const availability = checkProviderAvailable(options);
  if (!availability.ok) {
    return {
      ok: false,
      provider,
      model,
      message: `Provider unavailable: ${availability.message}`,
    };
  }

  const finalPrompt = buildPrompt(provider, prompt, options);
  const { command, args } = buildCommand(provider, finalPrompt, {
    cwd: options.cwd,
    model,
    budgetUsd: options.budgetUsd,
    skipPermissions: options.skipPermissions,
  });

  try {
    const result = execFileSync(command, args, {
      cwd: options.cwd,
      encoding: 'utf8',
      timeout: options.timeoutMs,
      env: options.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: options.maxBuffer || 10 * 1024 * 1024,
    });

    return {
      ok: true,
      provider,
      model,
      output: String(result || '').trim(),
    };
  } catch (error) {
    const detail = (error.stdout || error.stderr || error.message || '').toString().trim();
    return {
      ok: false,
      provider,
      model,
      error,
      message: detail || error.message,
    };
  }
}

module.exports = {
  SUPPORTED_PROVIDERS,
  defaultModelFor,
  normalizeProvider,
  resolveProviderConfig,
  checkProviderAvailable,
  runPrompt,
};
