# ADRs

Architecture Decision Records — short logs of decisions **already made**.

## Naming

`NNNN-short-title.md` (zero-padded sequence)  
Example: `0001-residence-scoped-tenancy.md`

## Template

```markdown
# ADR NNNN: Title

## Status

Accepted | Superseded by ADR-NNNN | Deprecated

## Context

What forces us to decide?

## Decision

What did we choose?

## Consequences

What becomes easier, harder, or out of scope?
```

## When to write an ADR

- After an RFC is accepted
- When an implementation choice is hard to reverse (DB tenancy, auth provider, status model)
- When “why did we do it this way?” will matter in six months
