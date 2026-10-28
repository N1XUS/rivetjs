// `@rivetjs/cdk/qr-code` path geometry in Chromium: every shape's SVG paths are hit-tested at each module centre
// (`isPointInFill` / `isPointInStroke` with the ui stroke settings), the sampled matrix must equal the encoder's
// modules, and it must decode (independent decoder, `qr-decode.ts`) back to the text — plain and with an excavated
// icon area. A scanner samples module centres the same way.
import { describe, expect, it } from "vitest";
import { centerRect, encodeQr, excavate, isFinderModule, qrPaths } from "../qr-code/index.tsx";
import type { QrShape } from "../qr-code/index.tsx";
import { decodeQr } from "./qr-decode.ts";

const NS = "http://www.w3.org/2000/svg";

const sample = (size: number, body: string, eyes: string, shape: QrShape): Uint8Array => {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("width", String(size * 4));
  const b = document.createElementNS(NS, "path");
  b.setAttribute("d", body);
  const e = document.createElementNS(NS, "path");
  e.setAttribute("d", eyes);
  if (shape === "dots") {
    b.setAttribute("fill", "none");
    b.setAttribute("stroke", "black");
    b.setAttribute("stroke-width", "0.84");
    b.setAttribute("stroke-linecap", "round");
    e.setAttribute("fill-rule", "evenodd");
  }
  svg.append(b, e);
  document.body.append(svg);
  const out = new Uint8Array(size * size);
  const pt = svg.createSVGPoint();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      pt.x = x + 0.5;
      pt.y = y + 0.5;
      const inBody = shape === "dots" ? b.isPointInStroke(pt) : b.isPointInFill(pt);
      out[y * size + x] = inBody || e.isPointInFill(pt) ? 1 : 0;
    }
  }
  svg.remove();
  return out;
};

describe("qr-code paths: module centres hit-test to the encoded matrix", () => {
  const texts = ["https://rivetjs.severyn.pro/components/qr-code", "WIFI:T:WPA;S:Studio Guest;P:paper-lantern-42;;", "0123456789".repeat(20)];
  for (const shape of ["square", "dots", "rounded"] as const) {
    it(`${shape}: plain + excavated icon area decode`, () => {
      for (const text of texts) {
        const qr = encodeQr(text, { ecc: "M" });
        const paths = qrPaths(qr, shape);
        const got = sample(qr.size, paths.body, paths.eyes, shape);
        for (let i = 0; i < got.length; i++) {
          const x = i % qr.size;
          const y = Math.floor(i / qr.size);
          // dots: finder eyes are drawn as rounded rects; centres still match the finder modules.
          if (shape !== "dots" || !isFinderModule(qr.size, x, y)) expect(got[i], `${shape} ${text} (${x},${y})`).toBe(qr.modules[i]);
        }
        expect(decodeQr(got, qr.size).text).toBe(text);

        const qh = encodeQr(text, { ecc: "H" });
        const modules = excavate(qh, centerRect(qh.size, 0.22), { keepAlignment: false });
        const p2 = qrPaths({ size: qh.size, modules }, shape);
        expect(decodeQr(sample(qh.size, p2.body, p2.eyes, shape), qh.size).text).toBe(text);
      }
    });
  }
});
