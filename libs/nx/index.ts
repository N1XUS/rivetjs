// @rivetjs/nx: Nx plugin for Rivet. Generators (generators.json), executors (executors.json), inferred tasks
// (`@rivetjs/nx/plugin`), migrations (migrations.json). Dev tooling only: no Rivet runtime entry imports it.
export { createNodes, createNodesV2, createRivetProject, CONFIG_GLOB, type RivetPluginOptions } from "./plugin.ts";
export { rivetTargets, targetNames, DEFAULT_TARGET_NAMES } from "./utils/targets.ts";
export { detectProject, routerMode, i18nLocales, type ProjectFacts } from "./utils/detect.ts";

export { initGenerator, type InitGeneratorSchema } from "./generators/init/generator.ts";
export { presetGenerator, type PresetGeneratorSchema } from "./generators/preset/generator.ts";
export { applicationGenerator, normalizeApplicationOptions, type ApplicationGeneratorSchema } from "./generators/application/generator.ts";
export { libraryGenerator, libraryExports, type LibraryGeneratorSchema } from "./generators/library/generator.ts";
export { componentGenerator, type ComponentGeneratorSchema } from "./generators/component/generator.ts";
export { routeGenerator, type RouteGeneratorSchema } from "./generators/route/generator.ts";
export { layoutGenerator, type LayoutGeneratorSchema } from "./generators/layout/generator.ts";
export { apiRouteGenerator, type ApiRouteGeneratorSchema } from "./generators/api-route/generator.ts";
export { uiSetupGenerator, type UiSetupGeneratorSchema } from "./generators/ui-setup/generator.ts";
export { i18nSetupGenerator, type I18nSetupGeneratorSchema } from "./generators/i18n-setup/generator.ts";

export { default as buildExecutor, buildSteps, type BuildExecutorSchema } from "./executors/build/executor.ts";
export { default as devExecutor, devStep, type DevExecutorSchema } from "./executors/dev/executor.ts";
export { default as previewExecutor, previewStep, type PreviewExecutorSchema } from "./executors/preview/executor.ts";
export { default as prerenderExecutor, prerenderStep, type PrerenderExecutorSchema } from "./executors/prerender/executor.ts";
export { default as checkExecutor, checkSteps, type CheckExecutorSchema } from "./executors/check/executor.ts";
export { default as testExecutor, testStep, type TestExecutorSchema } from "./executors/test/executor.ts";
export { default as typecheckExecutor, typecheckSteps, type TypecheckExecutorSchema } from "./executors/typecheck/executor.ts";
export { default as packageExecutor, distManifest, type PackageExecutorSchema } from "./executors/package/executor.ts";

export { default as exampleNoopMigration } from "./migrations/0.0.1/example-noop.ts";
