// VCLS contract helpers (`libs/compiler/static-class.ts`): every `@rivet-class` family of `@rivetjs/ui` with its
// component, resolver and `with` contexts loaded, and the constant prop combinations a call site can pass (each declared
// key over its definition's variant names + absent, booleans as `true` / `false`).
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { moduleFacts } from "@rivetjs/compiler";
import { classFamilies, type ClassFamily } from "../../compiler/static-class.ts";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");

export interface LoadedFamily {
  file: string;
  family: ClassFamily;
  component: (props: Record<string, unknown>) => unknown;
  resolver: ((props: Record<string, unknown>) => string) & { variants?: Record<string, Record<string, unknown>> };
  contexts: unknown[];
}

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? files(join(dir, d.name)) : d.name.endsWith(".tsx") ? [join(dir, d.name)] : [],
  );
}

/** Every declared family (sources scanned), loaded through the module's own imports. */
export async function loadFamilies(): Promise<LoadedFamily[]> {
  const out: LoadedFamily[] = [];
  for (const file of files(SRC)) {
    const source = readFileSync(file, "utf8");
    for (const family of classFamilies(source)) {
      const facts = moduleFacts(source, file);
      const mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
      const load = async (name: string) => {
        const imported = facts.imports.get(name);
        if (!imported) throw new Error(`${file}: ${name} is not imported`);
        const from = imported.from.startsWith(".") ? pathToFileURL(resolve(dirname(file), imported.from)).href : imported.from;
        return ((await import(from)) as Record<string, unknown>)[imported.imported];
      };
      out.push({
        file,
        family,
        component: mod[family.component] as LoadedFamily["component"],
        resolver: (await load(family.resolver)) as LoadedFamily["resolver"],
        contexts: await Promise.all(family.with.map(load)),
      });
    }
  }
  return out;
}

/** Constant prop combinations of a family's declared keys (absent = key left out). */
export function combinations(f: LoadedFamily): Record<string, unknown>[] {
  const domains = f.family.keys.map((key) => {
    const names = Object.keys(f.resolver.variants?.[key] ?? {});
    const values: unknown[] = names.map((n) => (n === "true" ? true : n === "false" ? false : n));
    if (names.includes("true") && !names.includes("false")) values.push(false);
    return [undefined, ...values];
  });
  let out: Record<string, unknown>[] = [{}];
  f.family.keys.forEach((key, i) => {
    out = out.flatMap((props) => domains[i]!.map((v) => (v === undefined ? props : { ...props, [key]: v })));
  });
  return out;
}
