/**
 * Evolution session helper - provides convenient wrappers for evolution system
 *
 * Usage from skills:
 * node -e "require('./lib/evolution-session.cjs').loadSessionGenes(['api'], 5).then(() => process.exit(0))"
 */

const signals = require('../.claude/skills/capability-evolver/scripts/signals.cjs');
const promote = require('../.claude/skills/capability-evolver/scripts/promote.cjs');
const redis = require('../.claude/skills/capability-evolver/scripts/redis.cjs');

/**
 * Load relevant genes for a session
 * @param {string[]} scenarioTags - Tags to match against genes
 * @param {number} limit - Max genes to load
 * @returns {Promise<Array>} - Array of matching genes
 */
async function loadSessionGenes(scenarioTags = [], limit = 5) {
  try {
    const genes = await promote.getRelevantGenes(scenarioTags, limit);
    if (genes.length > 0) {
      console.log(`\n🧬 Loaded ${genes.length} evolution genes:`);
      genes.forEach((g, i) => {
        const score = typeof g.gdiScore === 'string' ? parseFloat(g.gdiScore) : g.gdiScore;
        console.log(`   ${i + 1}. ${g.name || g.id} (GDI: ${score.toFixed(2)})`);
      });
      console.log('');
    }
    return genes;
  } catch (err) {
    // Non-blocking - continue without genes
    return [];
  } finally {
    await redis.close();
  }
}

/**
 * Initialize evolution tracking for a session
 * @param {string} sessionId - Session identifier
 * @param {object} context - Session context (project, task, etc.)
 */
async function initSessionEvolution(sessionId, context = {}) {
  try {
    await signals.initSession(sessionId, context);
    console.log(`🧬 Evolution: Session ${sessionId} initialized`);
  } catch (err) {
    // Non-blocking - continue without evolution
  } finally {
    await redis.close();
  }
}

/**
 * Emit a signal for evolution tracking
 * @param {string} sessionId - Session identifier
 * @param {string} type - Signal type (pattern, repair, completion, etc.)
 * @param {object} data - Signal data
 */
async function emitSignal(sessionId, type, data) {
  try {
    await signals.emit(type, data, sessionId);
  } catch (err) {
    // Non-blocking - signals are optional
  } finally {
    await redis.close();
  }
}

/**
 * Close evolution connection
 */
async function closeEvolution() {
  try {
    await redis.close();
  } catch (err) {
    // Ignore close errors
  }
}

module.exports = {
  loadSessionGenes,
  initSessionEvolution,
  emitSignal,
  closeEvolution
};
