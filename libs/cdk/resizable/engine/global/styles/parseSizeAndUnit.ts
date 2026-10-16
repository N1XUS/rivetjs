// Ported from react-resizable-panels (lib/global/styles/parseSizeAndUnit.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import type { SizeUnit } from "../../components/panel/types.ts";

export function parseSizeAndUnit(size: number | string): [numeric: number, size: SizeUnit] {
  switch (typeof size) {
    case "number": {
      return [size, "px"];
    }
    case "string": {
      const numeric = parseFloat(size);

      if (size.endsWith("%")) {
        return [numeric, "%"];
      } else if (size.endsWith("px")) {
        return [numeric, "px"];
      } else if (size.endsWith("rem")) {
        return [numeric, "rem"];
      } else if (size.endsWith("em")) {
        return [numeric, "em"];
      } else if (size.endsWith("vh")) {
        return [numeric, "vh"];
      } else if (size.endsWith("vw")) {
        return [numeric, "vw"];
      }

      return [numeric, "%"];
    }
  }
}
