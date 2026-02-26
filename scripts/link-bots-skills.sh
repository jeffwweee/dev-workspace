#!/bin/bash
# Link tg-bots skills to dev-workspace .claude/skills
# Usage: ./scripts/link-bots-skills.sh [--force]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(dirname "$SCRIPT_DIR")"
BOTS_MODULE="$WORKSPACE_ROOT/modules/bots"
SKILLS_DIR="$WORKSPACE_ROOT/.claude/skills"

FORCE="${1:-}"

echo "Linking tg-bots skills to dev-workspace..."

# Check if bots module exists
if [ ! -d "$BOTS_MODULE" ]; then
    echo "ERROR: modules/bots not found. Run 'git submodule update --init' first."
    exit 1
fi

# Link telegram-reply skill
SKILL_SRC="$BOTS_MODULE/packages/skills/src/telegram-reply"
SKILL_DST="$SKILLS_DIR/telegram-reply"

if [ -L "$SKILL_DST" ]; then
    echo "  telegram-reply: symlink exists, skipping"
elif [ -d "$SKILL_DST" ]; then
    if [ -n "$FORCE" ]; then
        echo "  telegram-reply: removing existing directory (force mode)"
        rm -rf "$SKILL_DST"
    else
        echo "  telegram-reply: directory exists, use --force to replace"
        exit 1
    fi
fi

if [ ! -L "$SKILL_DST" ] && [ -d "$SKILL_SRC" ]; then
    ln -s "$SKILL_SRC" "$SKILL_DST"
    echo "  telegram-reply: linked ✓"
fi

echo ""
echo "Skills linked successfully!"
echo "  Source: $BOTS_MODULE/packages/skills/src/"
echo "  Target: $SKILLS_DIR/"
