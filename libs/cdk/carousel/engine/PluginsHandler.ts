// Ported from embla-carousel (packages/embla-carousel/src/components/PluginsHandler.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts (erasable syntax; `{} as EmblaPluginsType`: the plugin packages augment that interface in one program here), formatting; otherwise verbatim.
import type { EmblaCarouselType } from "./EmblaCarousel.ts";
import type { OptionsHandlerType } from "./OptionsHandler.ts";
import type { EmblaPluginsType, EmblaPluginType } from "./Plugins.ts";

export type PluginsHandlerType = {
  init: (emblaApi: EmblaCarouselType, plugins: EmblaPluginType[]) => EmblaPluginsType;
  destroy: () => void;
};

export function PluginsHandler(optionsHandler: OptionsHandlerType): PluginsHandlerType {
  let activePlugins: EmblaPluginType[] = [];

  function init(emblaApi: EmblaCarouselType, plugins: EmblaPluginType[]): EmblaPluginsType {
    activePlugins = plugins.filter(({ options }) => optionsHandler.optionsAtMedia(options).active !== false);
    activePlugins.forEach((plugin) => plugin.init(emblaApi, optionsHandler));

    return plugins.reduce((map, plugin) => Object.assign(map, { [plugin.name]: plugin }), {} as EmblaPluginsType);
  }

  function destroy(): void {
    activePlugins = activePlugins.filter((plugin) => plugin.destroy());
  }

  const self: PluginsHandlerType = {
    init,
    destroy,
  };
  return self;
}
