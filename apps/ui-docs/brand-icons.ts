import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { inlineSvg } from "../../libs/compiler/images/svg.ts";

/** Use the ?svg pipeline's JSX emitter, exposing its source to Rivet's native-button proof. */
export function brandIcons(icons: Record<string, { svg: string; currentColor?: boolean }>): Plugin {
  let directory: string;
  const generated = new Map<string, Promise<string>>();
  return {
    name: "ui-docs-brand-icons",
    enforce: "pre",
    configResolved(config) {
      directory = resolve(config.root, ".rivet/brand-icons");
    },
    async resolveId(id) {
      const match = /^virtual:brand-icons\/([a-z0-9-]+)\.svg\?svg$/.exec(id);
      if (!match) return null;
      const name = match[1]!;
      const icon = Object.hasOwn(icons, name) ? icons[name] : undefined;
      if (!icon) this.error(`Unknown ui-docs brand icon: ${name}`);
      let file = generated.get(name);
      if (!file) {
        file = (async () => {
          // SVG 2 href survives the inline pipeline's namespace stripping across SVGO passes.
          const svg = icon.svg.replace(/\bxlink:href=/g, "href=");
          const hash = createHash("sha256").update(svg).update(String(!!icon.currentColor)).digest("hex").slice(0, 16);
          const path = resolve(directory, `${name}-${hash}.svg`);
          const { tsx, warnings } = await inlineSvg(path, svg, {}, { currentColor: icon.currentColor });
          for (const warning of warnings) this.warn(warning);
          await mkdir(directory, { recursive: true });
          await writeFile(path + ".tsx", tsx);
          return path + ".tsx";
        })();
        generated.set(name, file);
      }
      return file;
    },
  };
}
