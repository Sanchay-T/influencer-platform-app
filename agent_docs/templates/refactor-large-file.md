# Template: Refactor Large File

> **Use when:** A file exceeds 300 lines and needs splitting

## Analysis Phase

1. **Count lines:** `wc -l [file]`
2. **Identify sections:**
   - Types/interfaces
   - Constants/config
   - Helper functions
   - Main logic
   - UI components (if React)
3. **Map dependencies:** What imports what?

## Split Strategy

### For React Components (`.tsx`, `.jsx`)

```
components/
├── feature/
│   ├── index.tsx           # Main export, composition
│   ├── FeatureMain.tsx     # Primary component
│   ├── FeatureList.tsx     # Sub-component
│   ├── FeatureItem.tsx     # Sub-component
│   ├── hooks/
│   │   └── useFeature.ts   # Custom hooks
│   ├── utils/
│   │   └── helpers.ts      # Helper functions
│   └── types.ts            # Types/interfaces
```

### For Services (`.ts`)

```
lib/services/feature/
├── index.ts                # Public exports
├── feature-service.ts      # Main service
├── feature-validator.ts    # Validation logic
├── feature-transformer.ts  # Data transformation
├── types.ts                # Types
└── constants.ts            # Config/constants
```

## Checklist

```markdown
- [ ] Analysis
  - [ ] Count current lines
  - [ ] List all exports
  - [ ] Identify logical groupings
  - [ ] Map import/export dependencies

- [ ] Plan
  - [ ] Decide new file structure
  - [ ] List what moves where
  - [ ] Identify shared types to extract

- [ ] Extract Types First
  - [ ] Create types.ts
  - [ ] Move interfaces/types
  - [ ] Update imports

- [ ] Extract Utils/Helpers
  - [ ] Create utils/ or helpers.ts
  - [ ] Move pure functions
  - [ ] Update imports

- [ ] Extract Sub-components (React)
  - [ ] Create sub-component files
  - [ ] Move component code
  - [ ] Pass props appropriately

- [ ] Create Index
  - [ ] Re-export from index.ts
  - [ ] Maintain public API

- [ ] Verify
  - [ ] All files under 300 lines
  - [ ] No circular dependencies
  - [ ] App still works
  - [ ] Linter passes
```

## Common Extractions

| From | To | What |
|------|----|------|
| Component | `types.ts` | Props interfaces |
| Component | `hooks/useX.ts` | Custom hooks |
| Component | `utils/helpers.ts` | Non-React logic |
| Component | `SubComponent.tsx` | Repeated UI sections |
| Service | `types.ts` | Shared types |
| Service | `validator.ts` | Validation logic |
| Service | `transformer.ts` | Data mapping |

## Pitfalls

- Don't create too many tiny files (balance)
- Keep related code together
- Test after each extraction
- Update all import paths

## Reference

- Target: Each file < 300 lines
- Check `/health` command after refactor
