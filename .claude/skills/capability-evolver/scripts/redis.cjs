/**
 * Redis client for evolution system
 */

const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');
const os = require('os');

let client = null;

function loadConfig() {
  const configPath = path.join(os.homedir(), '.claude', 'evolution', 'config.yaml');
  if (!fs.existsSync(configPath)) {
    return { redis: { host: 'localhost', port: 6379, keyPrefix: 'evolution:' } };
  }
  const yaml = fs.readFileSync(configPath, 'utf8');
  const config = { redis: {} };
  const lines = yaml.split('\n');
  let inRedis = false;
  for (const line of lines) {
    if (line.startsWith('redis:')) { inRedis = true; continue; }
    if (inRedis && line.startsWith('  ')) {
      const [key, value] = line.trim().split(': ').map(s => s.replace(/"/g, ''));
      config.redis[key] = key === 'port' ? parseInt(value) : value;
    } else if (inRedis && !line.startsWith('  ') && !line.startsWith('#')) {
      inRedis = false;
    }
  }
  return config;
}

async function getClient() {
  if (client && client.status === 'ready') return client;
  const config = loadConfig();
  client = new Redis({
    host: config.redis.host || 'localhost',
    port: config.redis.port || 6379,
    keyPrefix: config.redis.keyPrefix || 'evolution:',
    lazyConnect: true
  });
  await client.connect();
  return client;
}

async function close() {
  if (client) { await client.quit(); client = null; }
}

const keys = {
  genesRegistry: () => 'genes:registry',
  gene: (id) => `gene:${id}`,
  geneMetadata: (id) => `gene:${id}:metadata`,
  capsulesRegistry: () => 'capsules:registry',
  capsule: (id) => `capsule:${id}`,
  events: () => 'events',
  sessionSignals: (sessionId) => `session:${sessionId}:signals`,
  sessionState: (sessionId) => `session:${sessionId}:state`,
  activeSessions: () => 'sessions:active',
  publishable: () => 'publishable',
  projectGenes: (projectId) => `project:${projectId}:genes`
};

module.exports = { getClient, close, keys, loadConfig };
