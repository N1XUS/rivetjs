// Ported from embla-carousel (packages/embla-carousel/src/index.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: `@rivetjs/cdk/carousel/engine` — the embla core, framework-free (`EmblaCarousel(root, options, plugins)`);
// default export kept, plus the named `EmblaCarousel`. Motion parts: `@rivetjs/cdk/motion`.
export type { EmblaOptionsType } from "./Options.ts";
export type { EmblaEventType } from "./EventHandler.ts";
export type { EmblaPluginType } from "./Plugins.ts";
export type { EmblaCarouselType } from "./EmblaCarousel.ts";
export { default, default as EmblaCarousel } from "./EmblaCarousel.ts";

export type { CreatePluginType, EmblaPluginsType } from "./Plugins.ts";
export type { CreateOptionsType } from "./Options.ts";
export type { OptionsHandlerType } from "./OptionsHandler.ts";
export type { EmblaEventListType } from "./EventHandler.ts";
export type { EngineType } from "./Engine.ts";
export type { ScrollBodyType } from "../../motion/ScrollBody.ts";
