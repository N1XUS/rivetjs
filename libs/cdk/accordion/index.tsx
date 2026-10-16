// `@rivetjs/cdk/accordion`: the Angular CDK accordion (angular/components src/cdk/accordion, MIT, © Google LLC)
// merged into the RAC Disclosure parts (user decision 2026-10-06). One implementation lives in
// `../disclosure/`; the Angular extras are on the same parts:
// - CdkAccordion `multi` → DisclosureGroup / createDisclosureGroupState `allowsMultipleExpanded` (boolean or Signal);
// - CdkAccordion `openAll()` / `closeAll()` → `openAll(state)` / `closeAll(state)` on a group state passed via
//   `<DisclosureGroup state>` (disabled disclosures keep their state);
// - CdkAccordionItem `(opened)` / `(closed)` / `(destroyed)` → Disclosure `onOpened` / `onClosed` / `onDestroyed`;
// - CdkAccordionItem `expanded` / `disabled` / `(expandedChange)` → RAC `isExpanded` / `isDisabled` / `onExpandedChange`.
export * from "../disclosure/index.tsx";
export {
  allowsMultiple,
  isKeyExpanded,
  registerDisclosure,
  setExpandedKeys,
  toggleKey,
  unregisterDisclosure,
  type DisclosureGroupProps as DisclosureGroupStateProps,
} from "../state/disclosure.ts";
