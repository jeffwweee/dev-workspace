// lib/tmux.ts
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface TmuxTarget {
  session: string;
  window: number;
  pane: number;
}

/**
 * Format tmux target string
 */
export function formatTmuxTarget(target: TmuxTarget): string {
  return `${target.session}:${target.window}.${target.pane}`;
}

/**
 * Inject command into tmux session
 * @param target - Tmux target (session, window, pane)
 * @param command - Command to inject (will be followed by Enter)
 * @throws Error if tmux command fails
 */
export async function injectTmuxCommand(
  target: TmuxTarget,
  command: string
): Promise<void> {
  const targetStr = formatTmuxTarget(target);
  const escapedCommand = command.replace(/"/g, '\\"');

  try {
    // Send the command text first (without Enter)
    await execAsync(`tmux send-keys -t ${targetStr} "${escapedCommand}"`);

    // Delay before sending Enter to ensure command is registered
    await new Promise(resolve => setTimeout(resolve, 300));

    // Then send Enter
    await execAsync(`tmux send-keys -t ${targetStr} Enter`);

    console.log(`[Tmux] Injected command into ${targetStr}: ${command.substring(0, 50)}...`);
  } catch (error) {
    console.warn(`[Tmux] Failed to inject command into ${targetStr}:`, error);
    throw error;
  }
}

/**
 * Check if tmux session exists
 */
export async function sessionExists(sessionName: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`tmux list-sessions -F '#{session_name}'`);
    const sessions = stdout.trim().split('\n');
    return sessions.includes(sessionName);
  } catch {
    return false;
  }
}

/**
 * Synchronous version for use in spawn routines
 */
export function injectTmuxCommandSync(target: TmuxTarget, command: string): void {
  const { execSync } = require('child_process');
  const targetStr = formatTmuxTarget(target);
  const escapedCommand = command.replace(/"/g, '\\"');

  execSync(`tmux send-keys -t ${targetStr} "${escapedCommand}"`);
  execSync('sleep 0.3');
  execSync(`tmux send-keys -t ${targetStr} Enter`);
}
