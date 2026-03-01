import {
  spawnAgent,
  killAgent,
  isAgentRunning,
  listAgentSessions,
  getCoreAgents
} from '../spawn-agent';
import { execSync } from 'child_process';

// Check if tmux is available
function isTmuxAvailable(): boolean {
  try {
    execSync('which tmux', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const tmuxAvailable = isTmuxAvailable();

describe('spawn-agent', () => {
  test('getCoreAgents returns expected agents', () => {
    const agents = getCoreAgents();
    expect(agents).toContain('backend');
    expect(agents).toContain('frontend');
    expect(agents).toContain('qa');
    expect(agents).toContain('review-git');
  });

  test('getCoreAgents returns a copy of the array', () => {
    const agents1 = getCoreAgents();
    const agents2 = getCoreAgents();
    expect(agents1).not.toBe(agents2); // Different references
    expect(agents1).toEqual(agents2); // Same contents
  });
});

// Tmux-dependent tests - only run if tmux is available
describe('spawn-agent with tmux', () => {
  const testAgent = 'test-spawn-agent';

  beforeAll(() => {
    if (!tmuxAvailable) {
      console.log('Skipping tmux tests - tmux not available');
    }
  });

  afterAll(() => {
    if (!tmuxAvailable) return;
    // Cleanup: kill test agent if running
    try {
      killAgent(testAgent, true);
    } catch {
      // Ignore cleanup errors
    }
  });

  // Skip all tests in this describe block if tmux is not available
  if (!tmuxAvailable) {
    test.skip('tmux not available - skipping tmux tests', () => {});
    return;
  }

  test('spawnAgent creates a new session', () => {
    const result = spawnAgent({
      name: testAgent,
      isAdhoc: true
    });

    expect(result.status).toBe('spawned');
    expect(result.sessionName).toBe(`cc-adhoc-${testAgent}`);
  });

  test('isAgentRunning detects running agent', () => {
    const running = isAgentRunning(testAgent, true);
    expect(running).toBe(true);
  });

  test('listAgentSessions includes spawned agent', () => {
    const sessions = listAgentSessions();
    expect(sessions).toContain(`cc-adhoc-${testAgent}`);
  });

  test('killAgent removes the session', () => {
    const result = killAgent(testAgent, true);
    expect(result.status).toBe('spawned');

    const running = isAgentRunning(testAgent, true);
    expect(running).toBe(false);
  });

  test('spawnAgent returns already_exists for existing session', () => {
    // Create first session
    spawnAgent({ name: testAgent, isAdhoc: true });

    // Try to create again
    const result = spawnAgent({ name: testAgent, isAdhoc: true });
    expect(result.status).toBe('already_exists');

    // Cleanup
    killAgent(testAgent, true);
  });

  test('isAgentRunning returns false for non-existent session', () => {
    const running = isAgentRunning('non-existent-agent', true);
    expect(running).toBe(false);
  });
});
