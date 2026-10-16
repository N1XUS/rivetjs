// Ported from embla-carousel (packages/embla-carousel/src/components/Plugins.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts (erasable syntax), formatting; otherwise verbatim.
import type { CreateOptionsType, LooseOptionsType } from "./Options.ts";
import type { EmblaCarouselType } from "./EmblaCarousel.ts";
import type { OptionsHandlerType } from "./OptionsHandler.ts";

export type LoosePluginType = {
  [key: string]: unknown;
};

export type CreatePluginType<TypeA extends LoosePluginType, TypeB extends LooseOptionsType> = TypeA & {
  name: string;
  options: Partial<CreateOptionsType<TypeB>>;
  init: (embla: EmblaCarouselType, OptionsHandler: OptionsHandlerType) => void;
  destroy: () => void;
};

export interface EmblaPluginsType {
  [key: string]: CreatePluginType<LoosePluginType, {}>;
}

export type EmblaPluginType = EmblaPluginsType[keyof EmblaPluginsType];
