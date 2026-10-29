import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { ImageDescriptor } from "@rivetjs/runtime/image-plan";
import { checkDirectives, validateConfig, type Directives, type ImagesConfig } from "./options.ts";
import { sharpProcessor } from "./processor.ts";
import { createPipeline } from "./pipeline.ts";
import { rivetCacheDir } from "../cache-dir.ts";
export { sharpProcessor, type ImageProcessor, type ImageMetadata, type EncodeOptions } from "./processor.ts";
export type { ImagesConfig, Directives } from "./options.ts";
export { svgoPlugins, type SvgoOptions, type SvgDirectives } from "./svg.ts";

/** Options of `getImage()`. */
export interface GetImageOptions {
  /** Directory served at `base` (e.g. the client build output). */
  outDir: string;
  base?: string;
  assetsDir?: string;
  config?: ImagesConfig;
  directives?: Directives & { preset?: string };
}
/** Process a file known only at runtime/prerender (CMS uploads); same descriptor as `?image`. */
export async function getImage(file: string, options: GetImageOptions): Promise<ImageDescriptor> {
  const config = options.config ?? {};
  validateConfig(config);
  const directives = checkDirectives(options.directives ?? {}, file);
  const pipeline = createPipeline({
    config,
    processor: config.processor ?? sharpProcessor(),
    base: options.base ?? "/",
    assetsDir: options.assetsDir ?? "assets",
    dev: false,
    cacheDir: config.cacheDir ? resolve(config.cacheDir) : join(rivetCacheDir(), "images"),
  });
  const { descriptor, assets } = await pipeline.describe(resolve(file), directives);
  await Promise.all(
    assets.map(async (asset) => {
      const target = join(options.outDir, asset.fileName);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, await pipeline.encode(asset));
    }),
  );
  return descriptor;
}
