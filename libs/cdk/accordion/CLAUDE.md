# @rivetjs/cdk/accordion
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Angular CDK accordion merged into RAC Disclosure (user decision 2026-10-06): no own components or state. The old `Accordion` / `AccordionItem` / `createAccordion` API is deleted (no aliases).

## Entry points
- `@rivetjs/cdk/accordion` → `index.tsx`: `export * from "../disclosure/index.tsx"` + group-state extras from `../state/disclosure.ts` (`allowsMultiple`, `isKeyExpanded`, `registerDisclosure`, `unregisterDisclosure`, `setExpandedKeys`, `toggleKey`, type `DisclosureGroupStateProps`)

## Mapping (Angular → Rivet)
- `cdkAccordion` → `DisclosureGroup`; `[multi]` → `allowsMultipleExpanded` (boolean / Signal)
- `cdkAccordionItem` → `Disclosure`; `expanded` / `disabled` / `(expandedChange)` → `isExpanded` / `isDisabled` / `onExpandedChange`; `(opened)` / `(closed)` / `(destroyed)` → `onOpened` / `onClosed` / `onDestroyed`
- `openAll()` / `closeAll()` → `openAll(state)` / `closeAll(state)` with `<DisclosureGroup state={createDisclosureGroupState(…)}>`

## Commands
- `npx vitest run --project cdk libs/cdk/tests/accordion.test.ts libs/cdk/tests/resume.test.ts`

## Gotchas
- Item-level Angular spec cases (accordion-item.spec) not ported as a browser test
- See [../disclosure/CLAUDE.md](../disclosure/CLAUDE.md) for behaviour, invariants and gaps

## See also
- [../CLAUDE.md](../CLAUDE.md), `apps/cdk-docs/content/components/accordion.md`, examples `apps/cdk-docs/examples/accordion-*/`
