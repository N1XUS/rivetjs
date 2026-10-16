// Ported from embla-carousel (packages/embla-carousel/src/components/ScrollLimit.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts (erasable syntax), formatting; otherwise verbatim.
import { Limit, type LimitType } from "../../motion/Limit.ts";
import { arrayLast } from "./utils.ts";

export type ScrollLimitType = {
  limit: LimitType;
};

export function ScrollLimit(contentSize: number, scrollSnaps: number[], loop: boolean): ScrollLimitType {
  const max = scrollSnaps[0];
  const min = loop ? max - contentSize : arrayLast(scrollSnaps);
  const limit = Limit(min, max);

  const self: ScrollLimitType = {
    limit,
  };
  return self;
}
