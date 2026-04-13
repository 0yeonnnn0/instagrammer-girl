'use strict';

const { execFileSync } = require('child_process');

const SUPPORTED_PROVIDERS = ['claude', 'codex'];

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

function runPrompt(prompt, options = {}) {
  const { provider, model } = resolveProviderConfig(options);
  const { command, args } = buildCommand(provider, prompt, {
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
  runPrompt,
};
