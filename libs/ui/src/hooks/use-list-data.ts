// HeroUI v3.2.6 re-exports react-stately `useListData`; the Rivet port already lives in the cdk (`createListData`, `@rivetjs/cdk/data`,
// resumable factory, signals). This module only gives it the HeroUI name: `useListData(options)` is `createListData(options)`
// (same object, call it once in a component body). Own module: nothing is bundled unless imported.
export { createListData as useListData } from "@rivetjs/cdk/data";
export type { ListData, ListOptions as UseListDataOptions } from "@rivetjs/cdk/data";
