import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getBotByRole } from './orchestration-config';

export interface SpawnOptions {
  name: string;
  persona?: string;
  skills?: string[];
  memoryFile?: string;
  isAdhoc?: boolean;
  model?: 'sonnet' | 'opus' | 'haiku';
  style?: 'professional' | 'casual';
}

export interface SpawnResult {
  sessionName: string;
  status: 'spawned' | 'already_exists' | 'error';
  error?: string;
}

export const CORE_AGENTS = ['backend', 'frontend', 'qa', 'review-git'] as const;

type CoreAgent = typeof CORE_AGENTS[number];

/**
 * Waits for a skill to fully load by checking tmux pane output
 * Looks for completion indicators like "Successfully loaded skill" or skill prompt
 */
function waitForSkillLoad(sessionName: string, skill: string, maxWaitMs = 15000): void {
  const startTime = Date.now();
  const checkInterval = 500; // Check every 500ms

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const output = execSync(`tmux capture-pane -t ${sessionName} -p -S -10 2>/dev/null`, { encoding: 'utf-8' });

      // Check for skill load completion indicators
      if (output.includes('Successfully loaded skill') ||
          output.includes('Skill loaded') ||
          output.includes('Identity established') ||
          output.includes('ready for messages') ||
          output.match(new RegExp(`/${skill}.*Use when`, 's'))) {
        // Skill loaded, wait a brief moment for stability
        execSync('sleep 0.5');
        return;
      }
    } catch {
      // Ignore errors, keep waiting
    }

    execSync(`sleep ${checkInterval / 1000}`);
  }

  // Timeout reached, proceed anyway but log warning
  console.warn(`[Spawn] Warning: Skill ${skill} may not have fully loaded after ${maxWaitMs}ms`);
}

/**
 * Spawns a Claude Code agent in a tmux session
 * Uses CLAUDECODE workaround to allow nested Claude Code sessions
 *
 * Reference: modules/bots/scripts/start-telegram-agent.sh for:
 * - Model selection: claude --model sonnet|opus|haiku
 * - Persona injection: /telegram-agent --name <bot> --who "<persona>"
 * - Style configuration: --response-style professional|casual
 */
export function spawnAgent(options: SpawnOptions): SpawnResult {
  const {
    name,
    persona,
    skills = [],
    memoryFile,
    isAdhoc = false,
    model = 'sonnet',
    style = 'professional'
  } = options;

  const sessionName = isAdhoc ? `cc-adhoc-${name}` : `cc-${name}`;

  // Check if session already exists
  try {
    execSync(`tmux has-session -t ${sessionName} 2>/dev/null`);
    return { sessionName, status: 'already_exists' };
  } catch {
    // Session doesn't exist, create it
  }

  // Create tmux session
  try {
    execSync(`tmux new-session -d -s ${sessionName} -x 200 -y 50 2>/dev/null || true`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { sessionName, status: 'error', error: message };
  }

  // Build initial prompt with telegram-agent identity
  // Pass directly to Claude CLI to eliminate startup delays
  let initialPrompt = '';
  const botConfig = getBotByRole(name);
  if (botConfig) {
    initialPrompt = `"/telegram-agent --name ${botConfig.name} --who \\"${persona || botConfig.role}\\""`;
  }

  // Read skills from config (preferred) or options (fallback)
  const configSkills = botConfig?.agent_config?.skills || [];
  const skillsToLoad = skills && skills.length > 0 ? skills : configSkills;

  // Start Claude with CLAUDECODE unset (workaround for nested sessions)
  // Initial prompt is passed directly as CLI argument
  const startCmd = `env -u CLAUDECODE claude --dangerously-skip-permissions --model ${model} ${initialPrompt}`;
  execSync(`tmux send-keys -t ${sessionName} '${startCmd}' Enter`);

  // Minimal wait for tmux to process
  execSync('sleep 1');

  // Configure agent if persona provided (legacy agent-setup)
  if (persona) {
    let agentCmd = `/agent-setup --who "${persona}" --response-style ${style}`;
    if (memoryFile) {
      agentCmd += ` --memory ${memoryFile}`;
    }
    execSync(`tmux send-keys -t ${sessionName} '${agentCmd}' Enter`);
    execSync('sleep 2');
  }

  // Load skills - wait for each to fully load before injecting next
  for (const skill of skillsToLoad) {
    execSync(`tmux send-keys -t ${sessionName} '/${skill}' Enter`);
    // Wait for skill to fully load (5 seconds per skill)
    execSync('sleep 5');
  }

  return { sessionName, status: 'spawned' };
}

/**
 * Kills an agent's tmux session
 */
export function killAgent(name: string, isAdhoc = false): SpawnResult {
  const sessionName = isAdhoc ? `cc-adhoc-${name}` : `cc-${name}`;

  try {
    execSync(`tmux kill-session -t ${sessionName} 2>/dev/null || true`);
    return { sessionName, status: 'spawned' }; // 'spawned' means 'killed' in this context
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { sessionName, status: 'error', error: message };
  }
}

/**
 * Checks if an agent session is running
 */
export function isAgentRunning(name: string, isAdhoc = false): boolean {
  const sessionName = isAdhoc ? `cc-adhoc-${name}` : `cc-${name}`;

  try {
    execSync(`tmux has-session -t ${sessionName} 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sends a command to an agent session
 */
export function sendToAgent(name: string, command: string, isAdhoc = false): void {
  const sessionName = isAdhoc ? `cc-adhoc-${name}` : `cc-${name}`;
  execSync(`tmux send-keys -t ${sessionName} '${command}' Enter`);
}

/**
 * Lists all running agent sessions
 */
export function listAgentSessions(): string[] {
  try {
    const output = execSync('tmux list-sessions -F "#{session_name}" 2>/dev/null').toString();
    return output.trim().split('\n').filter(s => s.startsWith('cc-'));
  } catch {
    return [];
  }
}

/**
 * Gets list of core agent names
 */
export function getCoreAgents(): string[] {
  return [...CORE_AGENTS];
}
