const redis = require('./redis.cjs');

const TIERS = {
  TIER1: { name: 'simple', minSuccessRate: 0.7, minUsageCount: 2 },
  TIER2: { name: 'complex', minGDIScore: 0.6, maxImpactScope: 5, requiresTier1: true },
  TIER3: { name: 'core', requireBehavioralTest: true, requireManualReview: true, requiresTier2: true }
};

function validateTier1(candidate) {
  const errors = [];
  if (candidate.metadata.successRate < TIERS.TIER1.minSuccessRate) {
    errors.push(`Success rate ${candidate.metadata.successRate} < ${TIERS.TIER1.minSuccessRate}`);
  }
  if (candidate.metadata.usageCount < TIERS.TIER1.minUsageCount) {
    errors.push(`Usage count ${candidate.metadata.usageCount} < ${TIERS.TIER1.minUsageCount}`);
  }
  return { passed: errors.length === 0, tier: 1, errors, confidence: candidate.confidence || candidate.metadata.successRate };
}

function calculateGDI(gene) {
  const metadata = gene.metadata || {};
  const weights = { quality: 0.35, usage: 0.30, social: 0.20, freshness: 0.15 };
  const qualityScore = metadata.successRate || 0;
  const usageScore = Math.min(Math.log10((metadata.usageCount || 0) + 1) / 2, 1);
  const socialScore = metadata.socialScore || 0.5;
  let freshnessScore = 0.5;
  if (metadata.lastUsed) {
    const daysSinceUse = (Date.now() - new Date(metadata.lastUsed).getTime()) / 86400000;
    freshnessScore = Math.max(0, 1 - (daysSinceUse / 30));
  }
  return weights.quality * qualityScore + weights.usage * usageScore + weights.social * socialScore + weights.freshness * freshnessScore;
}

function validate(candidate, targetTier = 1) {
  const tier1Result = validateTier1(candidate);
  if (targetTier === 1) return { ...tier1Result, gdiScore: calculateGDI(candidate) };
  if (targetTier >= 2) {
    const gdiScore = calculateGDI(candidate);
    const tier2Errors = [...tier1Result.errors];
    if (gdiScore < TIERS.TIER2.minGDIScore) tier2Errors.push(`GDI score ${gdiScore.toFixed(2)} < ${TIERS.TIER2.minGDIScore}`);
    if ((candidate.impactScope || 0) > TIERS.TIER2.maxImpactScope) tier2Errors.push(`Impact scope ${candidate.impactScope} > ${TIERS.TIER2.maxImpactScope}`);
    if (!tier1Result.passed) tier2Errors.unshift('Tier 1 validation failed');
    return { passed: tier2Errors.length === 0, tier: 2, errors: tier2Errors, confidence: candidate.confidence || gdiScore, gdiScore };
  }
  return validate(candidate, 2);
}

async function validateSessionCandidates(sessionId) {
  const client = await redis.getClient();
  const sessionState = await client.hgetall(redis.keys.sessionState(sessionId));
  if (!sessionState.candidates) return { success: true, validated: 0, passed: [], failed: [] };
  const candidates = JSON.parse(sessionState.candidates);
  const passed = [], failed = [];
  for (const candidate of candidates) {
    const result = validate(candidate, 1);
    if (result.passed) passed.push({ candidate, result });
    else failed.push({ candidate, result });
  }
  const event = { ts: new Date().toISOString(), type: 'validate', session: sessionId, data: { validated: candidates.length, passed: passed.length, failed: failed.length } };
  await client.lpush(redis.keys.events(), JSON.stringify(event));
  return { success: true, validated: candidates.length, passed, failed };
}

module.exports = { validate, validateTier1, validateSessionCandidates, calculateGDI, TIERS };
