#!/bin/bash
# SessionStart hook - Automatically triggers project-session skill

echo 'Welcome to dev-workspace!'
echo ''
echo 'Initializing workspace session...'
echo ''

# Check workspace state
if [ -f "state/active.json" ]; then
  echo "Current workspace status:"
  node bin/dw.js status 2>/dev/null
  echo ""
fi

# This output instructs Claude to run the project-session skill
echo "---"
echo "INSTRUCTION: Please run the project-session skill now to begin the orchestrated workflow."
echo "Use: /skill project-session"
echo "---"
