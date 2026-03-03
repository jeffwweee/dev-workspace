import {
  loadConfig,
  getWorkflow,
  getBotByRole,
  getBots,
  clearCache
} from '../orchestration-config';

describe('orchestration-config', () => {
  beforeEach(clearCache);

  test('loadConfig loads configuration', () => {
    const config = loadConfig();
    expect(config).toBeDefined();
    expect(config.bots).toBeDefined();
    expect(config.workflows).toBeDefined();
  });

  test('getWorkflow returns default workflow', () => {
    const workflow = getWorkflow();
    expect(workflow.pipeline).toContain('backend');
    expect(workflow.review_threshold).toBeGreaterThan(0);
  });

  test('getWorkflow returns named workflow', () => {
    const workflow = getWorkflow('backend_only');
    expect(workflow.pipeline).toContain('backend');
    expect(workflow.pipeline).not.toContain('frontend');
  });

  test('getBotByRole finds orchestrator bot', () => {
    const bot = getBotByRole('orchestrator');
    expect(bot).toBeDefined();
    expect(bot?.name).toBe('pichu');
  });

  test('getBotByRole finds backend bot', () => {
    const bot = getBotByRole('backend');
    expect(bot).toBeDefined();
    expect(bot?.name).toBe('pikachu');
  });

  test('getBots returns all bots', () => {
    const bots = getBots();
    expect(bots.length).toBe(5);
    expect(bots.map(b => b.role)).toContain('orchestrator');
    expect(bots.map(b => b.role)).toContain('backend');
    expect(bots.map(b => b.role)).toContain('frontend');
    expect(bots.map(b => b.role)).toContain('qa');
    expect(bots.map(b => b.role)).toContain('review-git');
  });
});
