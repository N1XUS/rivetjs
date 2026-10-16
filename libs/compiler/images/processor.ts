import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { EncodableFormat, ImageFormat, Placeholder } from "@rivetjs/runtime/image-plan";
import type { Fit } from "./options.ts";

/** Metadata an `ImageProcessor` reads from a source image. */
export interface ImageMetadata {
  /** Display orientation (EXIF rotation applied). */
  width: number;
  height: number;
  format: ImageFormat | "tiff";
  hasAlpha: boolean;
  animated: boolean;
}
/** One encode request to an `ImageProcessor`. */
export interface EncodeOptions {
  width: number;
  height?: number;
  format: EncodableFormat;
  quality: number;
  fit: Fit;
  position: string;
}
/** Swappable encoder; `id` (name@version) is part of every cache key. */
export interface ImageProcessor {
  id: string;
  metadata(input: Buffer): Promise<ImageMetadata>;
  encode(input: Buffer, options: EncodeOptions): Promise<Buffer>;
  placeholder(input: Buffer, kind: "blur" | "dominant-color"): Promise<Placeholder>;
}

type Sharp = typeof import("sharp").default;
/** libvips via sharp (optional peer); loaded on first use. */
export function sharpProcessor(): ImageProcessor {
  let loaded: Promise<Sharp> | undefined;
  const load = () =>
    (loaded ??= import("sharp").then(
      (m) => m.default,
      () => {
        throw new Error("`images` needs `sharp`: npm i -D sharp");
      },
    ));
  return processor(load, sharpVersion());
}
/** sharp's `exports` hide `package.json`: walk up from the resolved entry. */
function sharpVersion(): string {
  try {
    let dir = dirname(createRequire(import.meta.url).resolve("sharp"));
    for (let parent = dirname(dir); dir !== parent; dir = parent, parent = dirname(dir)) {
      const file = join(dir, "package.json");
      if (!existsSync(file)) continue;
      const json = JSON.parse(readFileSync(file, "utf8")) as { name?: string; version: string };
      if (json.name === "sharp") return json.version;
    }
  } catch {}
  return "missing";
}
function processor(load: () => Promise<Sharp>, version: string): ImageProcessor {
  return {
    id: `sharp@${version}`,
    async metadata(input) {
      const m = await (await load())(input).metadata();
      const format = m.format === "heif" ? (m.compression === "av1" ? "avif" : null) : m.format;
      if (!format || !["jpeg", "png", "webp", "avif", "gif", "svg", "tiff"].includes(format)) throw new Error(`unsupported image format "${m.format}"`);
      const rotated = (m.orientation ?? 1) >= 5;
      return {
        width: (rotated ? m.height : m.width)!,
        height: (rotated ? m.width : m.height)!,
        format: format as ImageMetadata["format"],
        hasAlpha: Boolean(m.hasAlpha),
        animated: (m.pages ?? 1) > 1,
      };
    },
    async encode(input, o) {
      const sharp = await load();
      const p = sharp(input, { animated: false }).rotate().resize({ width: o.width, height: o.height, fit: o.fit, position: o.position, withoutEnlargement: true });
      const out =
        o.format === "avif" ? p.avif({ quality: o.quality, effort: 4 })
        : o.format === "webp" ? p.webp({ quality: o.quality })
        : o.format === "jpeg" ? p.jpeg({ quality: o.quality, mozjpeg: true })
        : p.png({ quality: o.quality, palette: o.quality < 100, compressionLevel: 9 });
      return out.toBuffer();
    },
    async placeholder(input, kind) {
      const sharp = await load();
      if (kind === "dominant-color") {
        const { r, g, b } = (await sharp(input).stats()).dominant;
        return { kind: "color", value: "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("") };
      }
      const small = await sharp(input).rotate().resize(16).webp({ quality: 40 }).toBuffer();
      return { kind: "blur", src: `data:image/webp;base64,${small.toString("base64")}` };
    },
  };
}
