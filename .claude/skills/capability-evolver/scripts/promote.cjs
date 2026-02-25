const redis = require('./redis.cjs');
const validate = require('./validate.cjs');

async function promoteGene(gene, options = {}) {
  const client = await redis.getClient();
  const geneId = gene.id;
  const gdiScore = validate.calculateGDI(gene);
  await client.hset(redis.keys.gene(geneId), {
    id: geneId, type: gene.type || 'pattern', name: gene.name,
    description: gene.description || '', content: gene.content, version: gene.version || 1,
    publishable: gene.publishable || false, source: gene.source || 'session',
    scope: options.scope || 'workspace', projectId: options.projectId || '',
    createdAt: gene.metadata?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  await client.hset(redis.keys.geneMetadata(geneId), {
    successRate: (gene.metadata?.successRate || 0).toString(),
    usageCount: (gene.metadata?.usageCount || 0).toString(),
    lastUsed: gene.metadata?.lastUsed || new Date().toISOString(),
    consecutiveSuccesses: (gene.metadata?.consecutiveSuccesses || 0).toString(),
    consecutiveFailures: '0', gdiScore: gdiScore.toString()
  });
  await client.zadd(redis.keys.genesRegistry(), gdiScore, geneId);
  return { geneId, gdiScore };
}

async function promoteSessionCandidates(sessionId) {
  const client = await redis.getClient();
  const validationResult = await validate.validateSessionCandidates(sessionId);
  if (validationResult.passed.length === 0) {
    return { success: true, promoted: 0, genes: [], message: 'No candidates passed validation' };
  }
  const promoted = [];
  for (const { candidate } of validationResult.passed) {
    try {
      const result = await promoteGene(candidate);
      promoted.push(result);
      const event = { ts: new Date().toISOString(), type: 'promote', session: sessionId, data: { geneId: result.geneId, gdiScore: result.gdiScore } };
      await client.lpush(redis.keys.events(), JSON.stringify(event));
    } catch (error) {
      console.error(`Failed to promote ${candidate.id}:`, error.message);
    }
  }
  return { success: true, promoted: promoted.length, genes: promoted, message: `Promoted ${promoted.length} genes to registry` };
}

async function getTopGenes(limit = 10) {
  const client = await redis.getClient();
  const geneIds = await client.zrevrange(redis.keys.genesRegistry(), 0, limit - 1, 'WITHSCORES');
  const genes = [];
  for (let i = 0; i < geneIds.length; i += 2) {
    const geneId = geneIds[i], score = parseFloat(geneIds[i + 1]);
    const geneData = await client.hgetall(redis.keys.gene(geneId));
    const metadata = await client.hgetall(redis.keys.geneMetadata(geneId));
    genes.push({ id: geneId, ...geneData, metadata, gdiScore: score });
  }
  return genes;
}

module.exports = { promoteGene, promoteSessionCandidates, getTopGenes };
