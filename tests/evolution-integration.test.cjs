/**
 * Integration tests for the evolution system
 *
 * These tests verify:
 * - CLI commands work correctly
 * - Scripts load as valid CommonJS modules
 * - Session helper functions are accessible
 */

const { execSync } = require('child_process');
const path = require('path');

const run = (cmd) => {
  try {
    return execSync(cmd, {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
      timeout: 10000
    });
  } catch (e) {
    return e.stdout || e.stderr || e.message;
  }
};

describe('Evolution Integration', () => {
  test('evolve status command works', () => {
    const output = run('node bin/dw.js evolve status');
    // Should return JSON with status info
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('success');
    expect(parsed).toHaveProperty('connected');
    expect(parsed.success).toBe(true);
  });

  test('evolve export command works', () => {
    const output = run('node bin/dw.js evolve export');
    // Should return JSON with export results
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('success');
    expect(parsed).toHaveProperty('genes');
    expect(parsed).toHaveProperty('snapshot');
    expect(parsed.success).toBe(true);
  });

  test('evolve command without action defaults to status', () => {
    const output = run('node bin/dw.js evolve');
    // Should default to status behavior
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('success');
    expect(parsed).toHaveProperty('connected');
    expect(parsed.success).toBe(true);
  });

  test('evolve solidify requires --session argument', () => {
    const output = run('node bin/dw.js evolve solidify');
    expect(output).toContain('requires --session');
  });

  test('evolve publish requires --gene argument', () => {
    const output = run('node bin/dw.js evolve publish');
    expect(output).toContain('requires --gene');
  });

  test('evolve unknown action returns error', () => {
    const output = run('node bin/dw.js evolve unknown-action');
    expect(output).toContain('Unknown action');
  });

  test('session helper loads', () => {
    const output = run('node -e "require(\'./lib/evolution-session.cjs\'); console.log(\'ok\')"');
    expect(output).toContain('ok');
  });

  test('scripts are valid CommonJS - signals', () => {
    const output = run('node -e "require(\'./.claude/skills/capability-evolver/scripts/signals.cjs\'); console.log(\'ok\')"');
    expect(output).toContain('ok');
  });

  test('scripts are valid CommonJS - solidify', () => {
    const output = run('node -e "require(\'./.claude/skills/capability-evolver/scripts/solidify.cjs\'); console.log(\'ok\')"');
    expect(output).toContain('ok');
  });

  test('scripts are valid CommonJS - validate', () => {
    const output = run('node -e "require(\'./.claude/skills/capability-evolver/scripts/validate.cjs\'); console.log(\'ok\')"');
    expect(output).toContain('ok');
  });

  test('scripts are valid CommonJS - promote', () => {
    const output = run('node -e "require(\'./.claude/skills/capability-evolver/scripts/promote.cjs\'); console.log(\'ok\')"');
    expect(output).toContain('ok');
  });

  test('scripts are valid CommonJS - export', () => {
    const output = run('node -e "require(\'./.claude/skills/capability-evolver/scripts/export.cjs\'); console.log(\'ok\')"');
    expect(output).toContain('ok');
  });

  test('scripts are valid CommonJS - redis', () => {
    const output = run('node -e "require(\'./.claude/skills/capability-evolver/scripts/redis.cjs\'); console.log(\'ok\')"');
    expect(output).toContain('ok');
  });

  test('signals module exports expected functions', () => {
    const output = run(`node -e "
      const signals = require('./.claude/skills/capability-evolver/scripts/signals.cjs');
      const exports = Object.keys(signals);
      console.log(exports.join(','));
    "`);
    expect(output).toContain('emit');
    expect(output).toContain('getSessionSignals');
    expect(output).toContain('getRecentEvents');
    expect(output).toContain('initSession');
  });

  test('redis module exports expected functions', () => {
    const output = run(`node -e "
      const redis = require('./.claude/skills/capability-evolver/scripts/redis.cjs');
      const exports = Object.keys(redis);
      console.log(exports.join(','));
    "`);
    expect(output).toContain('getClient');
    expect(output).toContain('close');
    expect(output).toContain('keys');
  });

  test('export module exports expected functions', () => {
    const output = run(`node -e "
      const exp = require('./.claude/skills/capability-evolver/scripts/export.cjs');
      const exports = Object.keys(exp);
      console.log(exports.join(','));
    "`);
    expect(output).toContain('exportGenes');
    expect(output).toContain('exportAll');
    expect(output).toContain('createSnapshot');
    expect(output).toContain('geneToMarkdown');
  });

  test('evolution-session helper exports expected functions', () => {
    const output = run(`node -e "
      const helper = require('./lib/evolution-session.cjs');
      const exports = Object.keys(helper);
      console.log(exports.join(','));
    "`);
    expect(output).toContain('loadSessionGenes');
    expect(output).toContain('initSessionEvolution');
    expect(output).toContain('emitSignal');
    expect(output).toContain('closeEvolution');
  });
});
