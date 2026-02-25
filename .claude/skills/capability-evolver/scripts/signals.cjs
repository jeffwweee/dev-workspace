const redis = require('./redis.cjs');

const SIGNAL_TYPES = {
  PATTERN: 'pattern', REPAIR: 'repair', INNOVATION: 'innovation',
  COMPLETION: 'completion', INTERRUPTED: 'interrupted',
  TIMEOUT: 'timeout', STUCK: 'stuck', USE: 'use'
};

async function emit(type, data, sessionId) {
  const client = await redis.getClient();
  const signal = { ts: new Date().toISOString(), type: 'signal', category: type, session: sessionId, data };
  const signalJson = JSON.stringify(signal);
  await client.lpush(redis.keys.sessionSignals(sessionId), signalJson);
  await client.lpush(redis.keys.events(), signalJson);
  await client.expire(redis.keys.sessionSignals(sessionId), 86400);
  return signal;
}

async function getSessionSignals(sessionId) {
  const client = await redis.getClient();
  const signals = await client.lrange(redis.keys.sessionSignals(sessionId), 0, -1);
  return signals.map(s => JSON.parse(s)).reverse();
}

async function clearSessionSignals(sessionId) {
  const client = await redis.getClient();
  await client.del(redis.keys.sessionSignals(sessionId));
}

async function getRecentEvents(limit = 50) {
  const client = await redis.getClient();
  const events = await client.lrange(redis.keys.events(), 0, limit - 1);
  return events.map(e => JSON.parse(e));
}

async function initSession(sessionId, context = {}) {
  const client = await redis.getClient();
  await client.sadd(redis.keys.activeSessions(), sessionId);
  await client.hset(redis.keys.sessionState(sessionId), { startedAt: new Date().toISOString(), ...context });
  await client.expire(redis.keys.sessionState(sessionId), 172800);
  await emit('completion', { action: 'session-start', context }, sessionId);
}

module.exports = { SIGNAL_TYPES, emit, getSessionSignals, clearSessionSignals, getRecentEvents, initSession };
