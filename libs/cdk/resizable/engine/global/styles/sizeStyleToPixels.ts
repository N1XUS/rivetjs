// Ported from react-resizable-panels (lib/global/styles/sizeStyleToPixels.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { convertEmToPixels } from "./convertEmToPixels.ts";
import { convertRemToPixels } from "./convertRemToPixels.ts";
import { convertVhToPixels } from "./convertVhToPixels.ts";
import { convertVwToPixels } from "./convertVwToPixels.ts";
import { parseSizeAndUnit } from "./parseSizeAndUnit.ts";

export function sizeStyleToPixels({ axisSize, itemElement, styleProp }: { axisSize: number; itemElement: HTMLElement; styleProp: number | string }) {
  let pixels: number | undefined = undefined;

  const [size, unit] = parseSizeAndUnit(styleProp);

  switch (unit) {
    case "%": {
      pixels = (size / 100) * axisSize;
      break;
    }
    case "px": {
      pixels = size;
      break;
    }
    case "rem": {
      pixels = convertRemToPixels(itemElement, size);
      break;
    }
    case "em": {
      pixels = convertEmToPixels(itemElement, size);
      break;
    }
    case "vh": {
      pixels = convertVhToPixels(size);
      break;
    }
    case "vw": {
      pixels = convertVwToPixels(size);
      break;
    }
  }

  return pixels;
}
