# Shared Genes

Community-contributed genes for dev-workspace evolution system.

## How to Contribute

1. Create a gene in your local workspace
2. Mark it as publishable: `/evolve --publish <gene-id>`
3. Copy from `~/.claude/evolution/genes/_publishable/` to this directory
4. Submit a PR

## Gene Format

See [gene-template.md](../references/evolution/gene-template.md) for the standard format.

## Naming Convention

```
gene-YYYYMMDD-hash8.md
```

Example: `gene-20260225-a1b2c3d4.md`

## Review Process

All contributed genes are reviewed for:
- [ ] Clear, actionable content
- [ ] Valid YAML frontmatter
- [ ] Applicable to general use cases
- [ ] No project-specific or sensitive information
