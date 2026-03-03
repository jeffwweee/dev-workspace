# Plan: Spawn Agent Direct Prompt Injection

**Created:** 2026-03-02
**Issue:** Spawn agent uses delays to wait for Claude startup, which is unreliable

## Problem Analysis

Current spawn flow in `lib/spawn-agent.ts`:
1. Start Claude in tmux
2. `sleep 5` - wait for startup
3. Inject `/telegram-agent` command via tmux send-keys
4. `sleep 2` - wait for command to be processed

Issues:
- Fixed delays are unreliable (system load varies)
- Unnecessary waiting when Claude starts quickly
- Commands may be injected before Claude is ready

## Proposed Solution

Pass the initial prompt directly to Claude CLI:
```bash
claude --dangerously-skip-permissions --model sonnet "/telegram-agent --name pikachu --who backend"
```

This:
1. Eliminates all delays
2. Claude starts with command pre-loaded
3. More reliable - command is in input buffer from the start

## Tasks

### Task 1: Update spawnAgent function
- [ ] Build initial prompt string from bot config
- [ ] Pass prompt to Claude CLI as argument
- [ ] Remove sleep delays after Claude start

### Task 2: Handle multi-line prompt (if needed)
- [ ] Test if Claude CLI accepts multi-line prompts
- [ ] If not, chain commands with semicolons or separate injections

### Task 3: Update subsequent command injection
- [ ] Keep minimal delay (1-2s) for additional skills
- [ ] Or pass all commands as single prompt if possible

### Task 4: Test spawn with new approach
- [ ] Spawn a test agent
- [ ] Verify telegram-agent identity is set
- [ ] Verify agent can poll messages

## Files to Modify

1. `lib/spawn-agent.ts` - Update spawnAgent function

## Code Changes

### Before (lines 64-79)
```typescript
const startCmd = `env -u CLAUDECODE claude --dangerously-skip-permissions --model ${model}`;
execSync(`tmux send-keys -t ${sessionName} '${startCmd}' Enter`);

// Wait for startup
execSync('sleep 5');

// Inject telegram-agent identity
const botConfig = getBotByRole(name);
if (botConfig) {
  const identityCmd = `/telegram-agent --name ${botConfig.name} --who "${persona || botConfig.role}"`;
  execSync(`tmux send-keys -t ${sessionName} '${identityCmd}' Enter`);
  execSync('sleep 2');
}
```

### After
```typescript
// Build initial prompt with telegram-agent identity
let initialPrompt = '';
const botConfig = getBotByRole(name);
if (botConfig) {
  initialPrompt = `"/telegram-agent --name ${botConfig.name} --who \\"${persona || botConfig.role}\\""`;
}

const startCmd = `env -u CLAUDECODE claude --dangerously-skip-permissions --model ${model} ${initialPrompt}`;
execSync(`tmux send-keys -t ${sessionName} '${startCmd}' Enter`);

// Minimal wait for tmux to process
execSync('sleep 1');
```

## Verification

```bash
# Spawn test agent
npx tsx bin/cc-orch.ts spawn backend

# Check agent has identity set
tmux capture-pane -t cc-backend -p

# Should see telegram-agent identity confirmed
```
