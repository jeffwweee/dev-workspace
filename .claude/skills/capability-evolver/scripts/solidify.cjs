const redis = require('./redis.cjs');
const signals = require('./signals.cjs');
const crypto = require('crypto');

function analyzeSignals(sessionSignals) {
  const candidates = [];
  const patterns = {};
  for (const signal of sessionSignals) {
    if (signal.category === 'pattern') {
      const key = signal.data.pattern || 'unknown';
      if (!patterns[key]) patterns[key] = { count: 0, successes: 0, contexts: [] };
      patterns[key].count++;
      if (signal.data.success !== false) patterns[key].successes++;
      patterns[key].contexts.push(signal.data);
    }
  }
  for (const [patternName, data] of Object.entries(patterns)) {
    if (data.count >= 2) {
      const successRate = data.successes / data.count;
      candidates.push({
        id: generateGeneId(),
        type: 'pattern',
        name: patternName,
        description: `Pattern detected from session signals`,
        content: extractContent(patternName, data.contexts),
        metadata: { successRate, usageCount: data.count, createdAt: new Date().toISOString(), lastUsed: new Date().toISOString() },
        source: 'solidification',
        confidence: Math.min(successRate * (data.count / 5), 1)
      });
    }
  }
  const repairs = sessionSignals.filter(s => s.category === 'repair' && s.data.success);
  for (const repair of repairs) {
    candidates.push({
      id: generateGeneId(),
      type: 'pattern',
      name: `repair-${repair.data.error || 'unknown'}`,
      description: `Error recovery pattern: ${repair.data.fix}`,
      content: `When encountering ${repair.data.error}, apply fix: ${repair.data.fix}`,
      metadata: { successRate: 1.0, usageCount: 1, createdAt: new Date().toISOString(), lastUsed: new Date().toISOString() },
      source: 'solidification',
      confidence: 0.6
    });
  }
  return candidates;
}

function generateGeneId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const hash = crypto.randomBytes(4).toString('hex');
  return `gene-${date}-${hash}`;
}

function extractContent(patternName, contexts) {
  const examples = contexts.slice(0, 3).map(c => JSON.stringify(c)).join('\n');
  return `Pattern: ${patternName}\n\nExamples:\n${examples}`;
}

async function solidify(sessionId) {
  const client = await redis.getClient();
  const sessionSignals = await signals.getSessionSignals(sessionId);
  if (sessionSignals.length === 0) {
    return { success: true, signalsAnalyzed: 0, candidates: [], message: 'No signals to solidify' };
  }
  const candidates = analyzeSignals(sessionSignals);
  await client.hset(redis.keys.sessionState(sessionId), { candidates: JSON.stringify(candidates), solidifiedAt: new Date().toISOString() });
  const event = { ts: new Date().toISOString(), type: 'solidify', session: sessionId, data: { signalsAnalyzed: sessionSignals.length, candidatesCreated: candidates.length } };
  await client.lpush(redis.keys.events(), JSON.stringify(event));
  return { success: true, signalsAnalyzed: sessionSignals.length, candidates, message: `Created ${candidates.length} gene candidates from ${sessionSignals.length} signals` };
}

module.exports = { solidify, analyzeSignals, generateGeneId };
