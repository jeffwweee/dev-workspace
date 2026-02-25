# Evolution System

Dev-workspace's AI self-evolution infrastructure based on GEP (Genome Evolution Protocol).

## Overview

The evolution system enables Claude Code sessions to learn and improve over time by:

1. **Emitting signals** during work (patterns, repairs, completions)
2. **Solidifying** signals into gene candidates at session end
3. **Validating** candidates against quality gates
4. **Promoting** passed candidates to the gene registry
5. **Exporting** to file system for backup

## Architecture

```
Redis (Runtime)          File System (Backup)
├── Gene Registry    →   ~/.claude/evolution/genes/
├── Capsule Registry →   ~/.claude/evolution/capsules/
├── Event Stream     →   ~/.claude/evolution/logs/
└── Session Signals  →   (temporary, solidified at session end)
```

## Quick Start

The evolution system is automatically integrated with your workflow:

- **Session start**: Genes loaded into context
- **During work**: Skills emit signals passively
- **Session end**: Signals solidified into new genes

### Manual Commands

```bash
/evolve                    # Show evolution status
/evolve --solidify         # Force solidify current session
/evolve --export           # Export to file system backup
/evolve --publish <gene>   # Mark gene as publishable
```

## Sharing Genes

By default, all genes are private (stored in `~/.claude/evolution/genes/_private/`).

To share a gene with the community:
1. Mark it as publishable: `/evolve --publish <gene-id>`
2. It will be copied to `genes/_publishable/`
3. Submit a PR to contribute it to `shared-genes/`

## Files

| File | Purpose |
|------|---------|
| `GEP_PROTOCOL.md` | Protocol specification |
| `shared-genes/` | Community-contributed genes |

## Configuration

Edit `~/.claude/evolution/config.yaml` to customize:
- Redis connection settings
- Validation thresholds
- Decay settings
- Export schedule
