// Ported from embla-carousel (packages/embla-carousel-auto-height/src/components/AutoHeight.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts, formatting; `'embla-carousel'` imports / module augmentation → `../../engine/` files; otherwise verbatim.
import type { OptionsType } from "./Options.ts";
import type { EmblaEventType, CreatePluginType, EmblaCarouselType } from "../../engine/index.ts";

declare module "../../engine/Plugins.ts" {
  interface EmblaPluginsType {
    autoHeight: AutoHeightType;
  }
}

export type AutoHeightType = CreatePluginType<{}, OptionsType>;

export type AutoHeightOptionsType = AutoHeightType["options"];

function AutoHeight(userOptions: AutoHeightOptionsType = {}): AutoHeightType {
  let emblaApi: EmblaCarouselType;
  let slideHeights: number[] = [];
  const heightEvents: EmblaEventType[] = ["select", "slideFocus"];

  function init(emblaApiInstance: EmblaCarouselType): void {
    emblaApi = emblaApiInstance;

    const {
      options: { axis },
      slideRects,
    } = emblaApi.internalEngine();

    if (axis === "y") return;

    slideHeights = slideRects.map((slideRect) => slideRect.height);

    heightEvents.forEach((evt) => emblaApi.on(evt, setContainerHeight));
    setContainerHeight();
  }

  function destroy(): void {
    heightEvents.forEach((evt) => emblaApi.off(evt, setContainerHeight));
    const container = emblaApi.containerNode();
    container.style.height = "";
    if (!container.getAttribute("style")) container.removeAttribute("style");
  }

  function highestInView(): number | null {
    const { slideRegistry } = emblaApi.internalEngine();
    const selectedIndexes = slideRegistry[emblaApi.selectedScrollSnap()];

    if (!selectedIndexes) return null;

    return selectedIndexes.map((index) => slideHeights[index]).reduce((a, b) => Math.max(a, b), 0);
  }

  function setContainerHeight(): void {
    const height = highestInView();
    if (height === null) return;

    emblaApi.containerNode().style.height = `${highestInView()}px`;
  }

  const self: AutoHeightType = {
    name: "autoHeight",
    options: userOptions,
    init,
    destroy,
  };
  return self;
}

declare namespace AutoHeight {
  let globalOptions: AutoHeightOptionsType | undefined;
}

AutoHeight.globalOptions = undefined;

export default AutoHeight;
