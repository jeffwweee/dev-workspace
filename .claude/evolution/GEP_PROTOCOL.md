# GEP Protocol Specification

Genome Evolution Protocol (GEP) for dev-workspace AI self-evolution.

## Core Concepts

### Gene

Atomic capability unit - the smallest reusable piece of knowledge.

```yaml
id: gene-20260225-a1b2c3d4
type: pattern | prompt | config | workflow
name: "Descriptive name"
description: "What this gene does"
content: |
  The actual capability content
metadata:
  successRate: 0.85
  usageCount: 12
```

### Capsule

Complete task execution path - a composite of genes that solved a specific problem.

```yaml
id: cap-20260225-e5f6a7b8
name: "Task name"
genes:
  - gene-20260225-xxx
executionPath:
  - step: 1
    action: "Description"
validation:
  confidence: 0.92
```

### Signal

Event emitted during work that may lead to gene creation.

| Type | When Emitted |
|------|--------------|
| `pattern` | Repeated action detected |
| `repair` | Error successfully recovered |
| `innovation` | Novel solution worked |
| `completion` | Task completed |
| `interrupted` | User interrupted |
| `timeout` | Operation timed out |
| `stuck` | Review loop or internal error |

## Lifecycle

```
1. SIGNAL    → Emit during work
2. SOLIDIFY  → Convert signals to gene candidates (session end)
3. VALIDATE  → Apply quality gates
4. PROMOTE   → Add to registry
5. USE       → Load in future sessions
6. DECAY     → Prune if unused/underperforming
```

## Validation Tiers

| Tier | Criteria | Auto-Promote |
|------|----------|--------------|
| 1 | successRate ≥ 0.7, usage ≥ 2 | Yes |
| 2 | + GDI ≥ 0.6, impact ≤ 5 files | Yes |
| 3 | + behavioral tests, review | With audit |

## Decay Rules

| Condition | Action |
|-----------|--------|
| Unused > 7 days | Mark deprecated |
| Success rate < 0.5 | Demote to candidate |
| Deprecated + unused > 14 days | Remove |

## Redis Schema

```
evolution:genes:registry          # Sorted Set (GDI score)
evolution:gene:{id}               # Hash (gene data)
evolution:capsules:registry       # Set
evolution:capsule:{id}            # Hash
evolution:events                  # List (JSONL)
evolution:session:{id}:signals    # List (temporary)
evolution:publishable             # Set (gene IDs)
```
