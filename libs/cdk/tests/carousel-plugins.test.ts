// Ported from embla-carousel (packages/embla-carousel/src/__tests__/plugins.test.ts, v8.6.0), MIT, © David Jerleke.
// Changes: Vitest with Jest globals (`@rivetjs/testing/jest`), happy-dom instead of jsdom (`carousel/mocks/dom.ts`),
// module specifiers.
import { beforeEach, describe, expect, jest, test } from "@rivetjs/testing/jest";
import EmblaCarousel, { type EmblaCarouselType } from "../carousel/engine/EmblaCarousel.ts";
import { mockTestElements } from "./carousel/mocks/index.ts";
import { FIXTURE_PLUGINS } from "./carousel/fixtures/plugins.fixture.ts";
import type { EmblaPluginType } from "../carousel/engine/Plugins.ts";

const PLUGIN_ONE: EmblaPluginType = {
  name: "plugin-one",
  init: jest.fn(),
  destroy: jest.fn(),
  options: { active: true, breakpoints: {} },
};

const PLUGIN_TWO: EmblaPluginType = {
  name: "plugin-two",
  init: jest.fn(),
  destroy: jest.fn(),
  options: { active: true, breakpoints: {} },
};

describe("➡️  Plugins", () => {
  let emblaApi: EmblaCarouselType;

  beforeEach(() => {
    jest.clearAllMocks();
    emblaApi = EmblaCarousel(mockTestElements(FIXTURE_PLUGINS), {}, [PLUGIN_ONE, PLUGIN_TWO]);
  });

  test("Are initialized when the carousel is initialized with the constructor", () => {
    expect(PLUGIN_ONE.init).toHaveBeenCalledTimes(1);
    expect(PLUGIN_TWO.init).toHaveBeenCalledTimes(1);
  });

  test("Are destroyed and initalized again when the carousel reInit() method is called", () => {
    emblaApi.reInit();
    expect(PLUGIN_ONE.destroy).toHaveBeenCalledTimes(1);
    expect(PLUGIN_TWO.destroy).toHaveBeenCalledTimes(1);
    expect(PLUGIN_ONE.init).toHaveBeenCalledTimes(2);
    expect(PLUGIN_TWO.init).toHaveBeenCalledTimes(2);
  });

  test("Are destroyed when the carousel is destroyed", () => {
    emblaApi.destroy();
    expect(PLUGIN_ONE.destroy).toHaveBeenCalledTimes(1);
    expect(PLUGIN_TWO.destroy).toHaveBeenCalledTimes(1);
  });

  test("API:s are exposed when the plugins() method is called", () => {
    expect(emblaApi.plugins()[PLUGIN_ONE.name]).toEqual(PLUGIN_ONE);
    expect(emblaApi.plugins()[PLUGIN_TWO.name]).toEqual(PLUGIN_TWO);
  });
});
