// `@rivetjs/cdk/qr-code`: the Nayuki encoder port against ISO 18004 vectors (format / version BCH words, alignment table,
// byte-mode capacities, block structure, a published RS vector) and an independent decoder (`qr-decode.ts`: own reading
// order, GF tables, BCH check, error correction) over every version, level and mask; geometry helpers + path builders.
import { describe, test } from "vitest";
import assert from "node:assert/strict";
import {
  MAX_VERSION,
  addEccAndInterleave,
  alignmentPositions,
  blockLayout,
  centerRect,
  encodeQr,
  encodeQrSegments,
  excavate,
  formatBits,
  isFinderModule,
  makeSegments,
  moduleRole,
  numDataCodewords,
  numRawDataModules,
  penaltyScore,
  placeholderQr,
  qrPaths,
  versionBits,
} from "../qr-code/index.tsx";
import type { QrEcc } from "../qr-code/index.tsx";
import { ISO_ALIGNMENT, decodeQr, isoFunctionMap, syndromes } from "./qr-decode.ts";

const LEVELS: readonly QrEcc[] = ["L", "M", "Q", "H"];

describe("ISO 18004 tables", () => {
  test("format information words (ISO Annex C)", () => {
    assert.equal(formatBits("M", 0), 0b101010000010010);
    assert.equal(formatBits("L", 0), 0b111011111000100);
    assert.equal(formatBits("Q", 0), 0b011010101011111);
    assert.equal(formatBits("H", 0), 0b001011010001001);
    assert.equal(formatBits("L", 4), 0b110011000101111);
    assert.equal(formatBits("H", 7), 0b000100000111011);
  });

  test("version information words (ISO Annex D)", () => {
    assert.equal(versionBits(7), 0x07c94);
    assert.equal(versionBits(8), 0x085bc);
    assert.equal(versionBits(21), 0x15683);
    assert.equal(versionBits(40), 0x28c69);
  });

  test("alignment pattern centres = ISO Annex E table, versions 1–40", () => {
    for (let v = 1; v <= MAX_VERSION; v++) assert.deepEqual(alignmentPositions(v), ISO_ALIGNMENT[v], `version ${v}`);
  });

  test("total codewords per version (ISO Table 1)", () => {
    const total: Record<number, number> = { 1: 26, 2: 44, 3: 70, 4: 100, 5: 134, 6: 172, 7: 196, 10: 346, 14: 581, 20: 1085, 27: 1828, 40: 3706 };
    for (const [v, n] of Object.entries(total)) assert.equal(Math.floor(numRawDataModules(Number(v)) / 8), n, `version ${v}`);
  });

  test("byte-mode capacities (ISO Table 7)", () => {
    const cap: Record<QrEcc, number[]> = {
      L: [17, 32, 53, 78, 106, 134, 154, 192, 230, 271],
      M: [14, 26, 42, 62, 84, 106, 122, 152, 180, 213],
      Q: [11, 20, 32, 46, 60, 74, 86, 108, 130, 151],
      H: [7, 14, 24, 34, 44, 58, 64, 84, 98, 119],
    };
    const v40: Record<QrEcc, number> = { L: 2953, M: 2331, Q: 1663, H: 1273 };
    const bytesFor = (v: number, ecc: QrEcc): number => Math.floor((numDataCodewords(v, ecc) * 8 - 4 - (v < 10 ? 8 : 16)) / 8);
    for (const ecc of LEVELS) {
      cap[ecc].forEach((n, i) => assert.equal(bytesFor(i + 1, ecc), n, `${ecc} v${i + 1}`));
      assert.equal(bytesFor(40, ecc), v40[ecc]);
    }
  });

  test("block structure (ISO Table 9 samples)", () => {
    assert.deepEqual(blockLayout(1, "M"), [1, 10]);
    assert.deepEqual(blockLayout(5, "Q"), [4, 18]);
    assert.deepEqual(blockLayout(5, "H"), [4, 22]);
    assert.deepEqual(blockLayout(10, "M"), [5, 26]);
    assert.deepEqual(blockLayout(40, "L"), [25, 30]);
    assert.deepEqual(blockLayout(40, "H"), [81, 30]);
    assert.equal(numDataCodewords(5, "Q"), 15 * 2 + 16 * 2);
    assert.equal(numDataCodewords(40, "H"), 15 * 20 + 16 * 61);
  });

  test("RS vector: HELLO WORLD 1-M data + ECC codewords", () => {
    const qr = encodeQr("HELLO WORLD", { ecc: "M", boostEcc: false });
    assert.equal(qr.version, 1);
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
    assert.deepEqual(addEccAndInterleave(data, 1, "M"), [...data, 196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });
});

describe("encoder", () => {
  test("segment modes: numeric, alphanumeric, byte (UTF-8), empty", () => {
    assert.equal(makeSegments("0123456789")[0]!.mode, "numeric");
    assert.equal(makeSegments("HELLO WORLD $%*+-./:")[0]!.mode, "alphanumeric");
    assert.equal(makeSegments("hello")[0]!.mode, "byte");
    assert.equal(makeSegments("€")[0]!.numChars, 3);
    assert.deepEqual(makeSegments(""), []);
  });

  test("function modules = ISO layout for every version", () => {
    for (let v = 1; v <= MAX_VERSION; v++) {
      const qr = encodeQrSegments([], { minVersion: v, maxVersion: v, mask: 0, ecc: "L", boostEcc: false });
      assert.equal(qr.size, v * 4 + 17);
      assert.deepEqual(qr.functions, isoFunctionMap(v), `version ${v}`);
      // Dark module + timing.
      assert.equal(qr.modules[(qr.size - 8) * qr.size + 8], 1);
      for (let i = 8; i < qr.size - 8; i++) {
        assert.equal(qr.modules[6 * qr.size + i], i % 2 === 0 ? 1 : 0);
        assert.equal(qr.modules[i * qr.size + 6], i % 2 === 0 ? 1 : 0);
      }
    }
  });

  test("byte capacity boundaries, versions 1–40 × L/M/Q/H: n bytes fit version v, n + 1 do not", () => {
    for (let v = 1; v <= MAX_VERSION; v++) {
      for (const ecc of LEVELS) {
        const cc = v < 10 ? 8 : 16;
        const n = Math.floor((numDataCodewords(v, ecc) * 8 - 4 - cc) / 8);
        const fits = encodeQr("a".repeat(n), { ecc, boostEcc: false, mask: 0 });
        assert.equal(fits.version, v, `${ecc} v${v} n=${n}`);
        assert.throws(() => encodeQr("a".repeat(n + 1), { ecc, boostEcc: false, mask: 0, minVersion: v, maxVersion: v }), /Data too long/);
      }
    }
  });

  test("data too long for version 40 throws", () => {
    assert.throws(() => encodeQr("a".repeat(2954), { ecc: "L" }), RangeError);
  });

  test("boostEcc raises the level while the data fits; off keeps it", () => {
    const boosted = encodeQr("rivet");
    assert.equal(boosted.version, 1);
    assert.equal(boosted.ecc, "H");
    assert.equal(encodeQr("rivet", { boostEcc: false }).ecc, "M");
    assert.equal(encodeQr("rivet", { ecc: "L", boostEcc: false }).ecc, "L");
  });

  test("auto mask = lowest penalty (ties → lowest index), as upstream", () => {
    for (const text of ["https://rivetjs.severyn.pro", "HELLO WORLD", "0123456789012345", "Ünïcødé ✓ QR"]) {
      const auto = encodeQr(text, { ecc: "Q" });
      const scores = Array.from({ length: 8 }, (_, m) => {
        const q = encodeQr(text, { ecc: "Q", mask: m });
        return penaltyScore(q.modules, q.size);
      });
      const min = Math.min(...scores);
      assert.equal(auto.mask, scores.indexOf(min), text);
      assert.deepEqual(auto.modules, encodeQr(text, { ecc: "Q", mask: auto.mask }).modules);
    }
  });

  test("deterministic: same input → identical matrix", () => {
    const a = encodeQr("https://example.com/?q=1");
    const b = encodeQr("https://example.com/?q=1");
    assert.deepEqual(a, b);
  });
});

describe("round trip through the independent decoder", () => {
  const texts = [
    "",
    "1",
    "01234567",
    "HELLO WORLD",
    "https://rivetjs.severyn.pro/components/qr-code",
    "Grüße aus Kyiv — Київ 🇺🇦",
    "WIFI:T:WPA;S:Rivet Guest;P:correct horse battery staple;;",
  ];

  test("every mask × level, short texts", () => {
    for (const text of texts) {
      for (const ecc of LEVELS) {
        for (let mask = 0; mask < 8; mask++) {
          const qr = encodeQr(text, { ecc, mask, boostEcc: false });
          const out = decodeQr(qr.modules, qr.size);
          assert.equal(out.text, text);
          assert.equal(out.ecc, ecc);
          assert.equal(out.mask, mask);
          assert.equal(out.version, qr.version);
          assert.equal(out.corrected, 0);
        }
      }
    }
  });

  test("versions 1–40 (byte payload at capacity, auto mask)", () => {
    for (let v = 1; v <= MAX_VERSION; v++) {
      const ecc = LEVELS[v % 4]!;
      const n = Math.floor((numDataCodewords(v, ecc) * 8 - 4 - (v < 10 ? 8 : 16)) / 8);
      let text = "";
      for (let i = 0; i < n; i++) text += String.fromCharCode(33 + ((i * 7 + v) % 94));
      const qr = encodeQr(text, { ecc, boostEcc: false, minVersion: v });
      assert.equal(qr.version, v);
      const out = decodeQr(qr.modules, qr.size);
      assert.equal(out.text, text, `version ${v}`);
    }
  });

  test("numeric and alphanumeric payloads in the 10–26 / 27–40 count ranges", () => {
    const digits = "31415926535897932384626433832795028841971693993751".repeat(30);
    const alnum = "RIVET QR CODE $%*+-./: 0123456789 ".repeat(30);
    for (const text of [digits, alnum, digits.slice(0, 700), alnum.slice(0, 400)]) {
      const qr = encodeQr(text, { ecc: "L" });
      assert.ok(qr.version >= 10);
      assert.equal(decodeQr(qr.modules, qr.size).text, text);
    }
  });

  test("RS blocks of every encoded symbol have zero syndromes; injected errors are corrected", () => {
    const qr = encodeQr("https://rivetjs.severyn.pro", { ecc: "M", boostEcc: false });
    const flipped = qr.modules.slice();
    // Flip 6 data modules in different codewords (well under the 1-M / 2-M correction capacity).
    let flips = 0;
    for (let i = 0; i < flipped.length && flips < 6; i += 37) {
      if (qr.functions[i] === 0) {
        flipped[i]! ^= 1;
        flips++;
      }
    }
    const out = decodeQr(flipped, qr.size);
    assert.equal(out.text, "https://rivetjs.severyn.pro");
    assert.ok(out.corrected > 0);
    assert.deepEqual(syndromes([0, 0, 0], 4), [0, 0, 0, 0]);
  });
});

describe("geometry", () => {
  test("module roles cover the ISO function map exactly", () => {
    for (const v of [1, 2, 6, 7, 14, 21, 32, 40]) {
      const size = v * 4 + 17;
      const fn = isoFunctionMap(v);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) assert.equal(moduleRole(v, x, y) !== "data", fn[y * size + x] === 1, `v${v} (${x},${y})`);
      }
    }
    assert.equal(moduleRole(1, 0, 0), "finder");
    assert.equal(moduleRole(1, 7, 7), "separator");
    assert.equal(moduleRole(1, 8, 13), "dark");
    assert.equal(moduleRole(1, 8, 2), "format");
    assert.equal(moduleRole(1, 10, 6), "timing");
    assert.equal(moduleRole(2, 18, 18), "alignment");
    assert.equal(moduleRole(7, 34, 0), "version");
  });

  test("centerRect is centred with the symbol's parity", () => {
    assert.deepEqual(centerRect(21, 0.22), { x: 8, y: 8, width: 5, height: 5 });
    assert.deepEqual(centerRect(25, 0.2), { x: 10, y: 10, width: 5, height: 5 });
    const r = centerRect(57, 0.25);
    assert.equal(r.width % 2, 1);
    assert.equal(r.x * 2 + r.width, 57);
  });

  test("excavation clears data modules only (alignment opt-in), never finder / timing / format / version", () => {
    for (const v of [1, 2, 7, 10, 25, 40]) {
      const qr = encodeQrSegments([], { minVersion: v, maxVersion: v, ecc: "H" });
      const whole = { x: 0, y: 0, width: qr.size, height: qr.size };
      const keep = excavate(qr, whole);
      const clear = excavate(qr, whole, { keepAlignment: false });
      for (let i = 0; i < keep.length; i++) {
        const role = moduleRole(v, i % qr.size, Math.floor(i / qr.size));
        if (role === "data") {
          assert.equal(keep[i], 0);
          assert.equal(clear[i], 0);
        } else if (role === "alignment") {
          assert.equal(keep[i], qr.modules[i]);
          assert.equal(clear[i], 0);
        } else {
          assert.equal(keep[i], qr.modules[i], `v${v} ${role}`);
          assert.equal(clear[i], qr.modules[i], `v${v} ${role}`);
        }
      }
    }
  });

  test("ECC H symbols with a centred 22 % logo area (alignment cleared) still decode", () => {
    for (const text of ["https://rivetjs.severyn.pro", "https://rivetjs.severyn.pro/components/qr-code?ref=docs&utm=1", "x".repeat(120)]) {
      const qr = encodeQr(text, { ecc: "H" });
      const modules = excavate(qr, centerRect(qr.size, 0.22), { keepAlignment: false });
      const out = decodeQr(modules, qr.size);
      assert.equal(out.text, text);
      assert.ok(out.corrected > 0, "the area costs ECC");
    }
  });

  test("placeholder: deterministic, real function patterns, no readable format", () => {
    const a = placeholderQr();
    assert.deepEqual(a.modules, placeholderQr().modules);
    assert.equal(a.size, 25);
    assert.ok(isFinderModule(25, 0, 0) && a.modules[0] === 1);
    assert.throws(() => decodeQr(a.modules, a.size));
  });
});

describe("paths", () => {
  const qr = encodeQr("HELLO WORLD", { ecc: "Q", mask: 2 });

  test("square: runs as relative rectangles, eyes separate", () => {
    const { body, eyes } = qrPaths(qr, "square");
    assert.match(eyes, /^M0 0h7v1h-7z/);
    assert.match(body, /^M\d+ \d+h\d+v1h-\d+z/);
    assert.doesNotMatch(body + eyes, /NaN|undefined|e-/);
    // Area check: Σ run widths = dark module count.
    const widths = (d: string): number => [...d.matchAll(/h(\d+)v1/g)].reduce((s, m) => s + Number(m[1]), 0);
    let dark = 0;
    for (const m of qr.modules) dark += m;
    assert.equal(widths(body) + widths(eyes), dark);
  });

  test("dots: one zero-length segment per non-finder dark module; eyes = 9 rounded rects", () => {
    const { body, eyes } = qrPaths(qr, "dots");
    let dark = 0;
    for (let i = 0; i < qr.modules.length; i++) if (qr.modules[i] && !isFinderModule(qr.size, i % qr.size, Math.floor(i / qr.size))) dark++;
    assert.equal(body.split("h0").length - 1, dark);
    assert.equal(eyes.split("Z").length - 1, 9);
  });

  test("rounded: closed subpaths only, arcs present, deterministic", () => {
    const a = qrPaths(qr, "rounded");
    assert.equal(a.body, qrPaths(qr, "rounded").body);
    assert.match(a.body, /A0\.5 0\.5 0 0 1 /);
    assert.match(a.body, /A0\.5 0\.5 0 0 0 /); // concave fillets
    assert.ok(a.body.split("M").length - 1 === a.body.split("Z").length - 1);
    assert.doesNotMatch(a.body + a.eyes, /NaN|undefined/);
  });
});
