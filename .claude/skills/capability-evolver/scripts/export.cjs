const redis = require('./redis.cjs');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EVOLUTION_DIR = path.join(os.homedir(), '.claude', 'evolution');

async function exportGenes() {
  const client = await redis.getClient();
  const geneIds = await client.zrange(redis.keys.genesRegistry(), 0, -1);
  const exported = [];
  const privateDir = path.join(EVOLUTION_DIR, 'genes', '_private');
  const publishableDir = path.join(EVOLUTION_DIR, 'genes', '_publishable');
  for (const geneId of geneIds) {
    const geneData = await client.hgetall(redis.keys.gene(geneId));
    const metadata = await client.hgetall(redis.keys.geneMetadata(geneId));
    const gene = { id: geneId, ...geneData, metadata };
    const content = geneToMarkdown(gene);
    const targetDir = gene.publishable === 'true' ? publishableDir : privateDir;
    const filePath = path.join(targetDir, `${geneId}.md`);
    fs.writeFileSync(filePath, content, 'utf8');
    exported.push({ geneId, path: filePath });
  }
  return { success: true, exported: exported.length, genes: exported };
}

function geneToMarkdown(gene) {
  return `---
id: ${gene.id}
type: ${gene.type || 'pattern'}
name: "${gene.name || 'Unnamed'}"
description: "${gene.description || ''}"
version: ${gene.version || 1}
publishable: ${gene.publishable || false}
---

# Gene: ${gene.name || gene.id}

## Content

\`\`\`
${gene.content || ''}
\`\`\`

## Metadata

| Field | Value |
|-------|-------|
| Created | ${gene.createdAt || 'unknown'} |
| Success Rate | ${gene.metadata?.successRate || 0} |
| Usage Count | ${gene.metadata?.usageCount || 0} |
| GDI Score | ${gene.metadata?.gdiScore || 0} |
`;
}

async function createSnapshot() {
  const client = await redis.getClient();
  const date = new Date().toISOString().slice(0, 10);
  const snapshotPath = path.join(EVOLUTION_DIR, 'export', `snapshot-${date}.json`);
  const geneIds = await client.zrange(redis.keys.genesRegistry(), 0, -1, 'WITHSCORES');
  const genes = {};
  for (let i = 0; i < geneIds.length; i += 2) {
    const geneId = geneIds[i], score = geneIds[i + 1];
    genes[geneId] = {
      data: await client.hgetall(redis.keys.gene(geneId)),
      metadata: await client.hgetall(redis.keys.geneMetadata(geneId)),
      gdiScore: score
    };
  }
  const events = await client.lrange(redis.keys.events(), 0, 99);
  const publishable = await client.smembers(redis.keys.publishable());
  const snapshot = { version: '0.1.0', exportedAt: new Date().toISOString(), genes, events: events.map(e => JSON.parse(e)), publishable };
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');
  return { success: true, path: snapshotPath, genesExported: Object.keys(genes).length, eventsExported: events.length };
}

async function exportAll() {
  const genesResult = await exportGenes();
  const snapshotResult = await createSnapshot();
  return { success: true, genes: genesResult, snapshot: snapshotResult };
}

module.exports = { exportGenes, exportAll, createSnapshot, geneToMarkdown };
