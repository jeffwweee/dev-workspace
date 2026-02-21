#!/bin/bash
# dw-helper.sh - Shell helper for dev-workspace CLI
# Source this file or add to your shell config:
#   source /path/to/dw-helper.sh

# Get the directory where this script is located
# Use absolute path to avoid issues when sourced from different directories
DW_ROOT="/Users/jeffwweee/jef/dev-workspace"

# Start working on a project (switches to project directory)
dw-work() {
    if [ -z "$1" ]; then
        echo "Usage: dw-work <project-name>"
        return 1
    fi

    local result
    result=$(node "$DW_ROOT/bin/dw.js" work "$1" --json)

    if echo "$result" | grep -q '"success": true'; then
        local project_path shell_cmd
        project_path=$(echo "$result" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.project.path)")
        shell_cmd=$(echo "$result" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.shellCommand)")

        echo "📂 Working on: $(echo "$result" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.project.name)")"
        echo "📍 Path: $project_path"
        local skills=$(echo "$result" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.skillCount || 0)")
        if [ "$skills" -gt 0 ]; then
            echo "🎯 Skills available: $skills"
        fi
        echo ""

        # Change directory
        cd "$project_path" || return 1
    else
        echo "❌ Failed to switch project"
        echo "$result" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.message || d.error)"
        return 1
    fi
}

# Finish working on current project (returns to dev-workspace)
dw-done() {
    local result
    result=$(node "$DW_ROOT/bin/dw.js" done --json)

    if echo "$result" | grep -q '"success": true'; then
        local workspace_root
        workspace_root=$(echo "$result" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.workspaceRoot)")

        echo "✅ Returned to dev-workspace root"
        echo "📍 Path: $workspace_root"

        # Change directory
        cd "$workspace_root" || return 1
    else
        echo "❌ Failed to return to workspace"
        echo "$result" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.message || d.error)"
        return 1
    fi
}

# Quick status check
dw-status() {
    node "$DW_ROOT/bin/dw.js" status --json | node -e "
        const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
        console.log('Session:', d.session?.sessionId || 'none');
        console.log('Active Project:', d.session?.activeProject || 'none');
        console.log('Locks:', d.locks?.total || 0);
        console.log('Projects:', d.projects?.total || 0);
    "
}

# Initialize session
dw-init() {
    node "$DW_ROOT/bin/dw.js" init
}

# List projects
dw-projects() {
    node "$DW_ROOT/bin/dw.js" list-projects --json | node -e "
        const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
        d.projects.forEach(p => console.log(\`  \${p.name.padEnd(20)} \${p.path}\`));
    "
}

echo "🛠️  Dev-workspace helpers loaded: dw-init, dw-work, dw-done, dw-status, dw-projects"
