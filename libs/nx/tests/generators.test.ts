// Every generator on an in-memory Nx tree (`createTreeWithEmptyWorkspace`): files written, key file snapshots, flags
// and errors. Nothing touches the disk (the generators are --dry-run safe by construction: Tree writes only).
import { readJson, readNxJson, readProjectConfiguration, updateNxJson } from "@nx/devkit";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProject } from "create-rivet";
import { deployOverlay, type DeployTarget } from "create-rivet/deploy";
import { describe, expect, test } from "vitest";
import { apiRouteGenerator } from "../generators/api-route/generator.ts";
import { applicationGenerator } from "../generators/application/generator.ts";
import { componentGenerator } from "../generators/component/generator.ts";
import { i18nSetupGenerator } from "../generators/i18n-setup/generator.ts";
import { initGenerator, PLUGIN } from "../generators/init/generator.ts";
import { layoutGenerator } from "../generators/layout/generator.ts";
import { libraryGenerator } from "../generators/library/generator.ts";
import { presetGenerator } from "../generators/preset/generator.ts";
import { routeGenerator, routeUrl, sampleEntry } from "../generators/route/generator.ts";
import { uiSetupGenerator, uiStyles } from "../generators/ui-setup/generator.ts";
import { routeComponentName, routeParams, routeSegments } from "../utils/project.ts";
import { RIVET_NX_VERSION } from "../utils/versions.ts";
import { emptyWorkspace, filesUnder, read } from "./helpers.ts";

const app = async (template: "static" | "server" | "ui" | "minimal" = "static", extra: Record<string, unknown> = {}) => {
  const tree = emptyWorkspace();
  await applicationGenerator(tree, { directory: "apps/web", template, skipInstall: true, ...extra });
  return tree;
};

describe("init", () => {
  test("registers the plugin once, adds tooling, ignores .rivet", async () => {
    const tree = emptyWorkspace();
    await initGenerator(tree, { skipInstall: true });
    await initGenerator(tree, { skipInstall: true });
    const plugins = readNxJson(tree)!.plugins!.filter((entry) => (typeof entry === "string" ? entry : entry.plugin) === PLUGIN);
    expect(plugins).toHaveLength(1);
    expect(plugins[0]).toMatchSnapshot();
    const pkg = readJson(tree, "package.json");
    expect(pkg.devDependencies["@rivetjs/nx"]).toBe(RIVET_NX_VERSION);
    expect(Object.keys(pkg.devDependencies).sort()).toEqual([
      "@rivetjs/compiler",
      "@rivetjs/language-core",
      "@rivetjs/nx",
      "@rivetjs/typescript-plugin",
      "@types/node",
      "typescript",
      "vite",
    ]);
    expect(read(tree, ".gitignore").split("\n")).toContain(".rivet");
  });

  test("addPlugin false / useInferencePlugins false: no plugin entry", async () => {
    const tree = emptyWorkspace();
    await initGenerator(tree, { addPlugin: false, skipInstall: true });
    expect(readNxJson(tree)!.plugins ?? []).toEqual([]);
    const other = emptyWorkspace();
    updateNxJson(other, { ...readNxJson(other)!, useInferencePlugins: false });
    await initGenerator(other, { skipInstall: true });
    expect(readNxJson(other)!.plugins ?? []).toEqual([]);
  });

  test("rivetVersion overrides the @rivetjs/* spec", async () => {
    const tree = emptyWorkspace();
    await initGenerator(tree, { rivetVersion: "experimental", skipInstall: true });
    expect(readJson(tree, "package.json").devDependencies["@rivetjs/compiler"]).toBe("experimental");
  });
});

describe("application", () => {
  test("static starter: create-rivet files, project.json, vitest, no npm scripts", async () => {
    const tree = await app("static");
    expect(filesUnder(tree, "apps/web")).toMatchSnapshot();
    expect(readJson(tree, "apps/web/project.json")).toMatchSnapshot();
    const pkg = readJson(tree, "apps/web/package.json");
    expect(pkg.name).toBe("web");
    expect(pkg.scripts).toBeUndefined();
    expect(pkg.dependencies["@rivetjs/router"]).toBe(RIVET_NX_VERSION);
    expect(pkg.devDependencies["@rivetjs/testing"]).toBe(RIVET_NX_VERSION);
    expect(read(tree, "apps/web/vitest.config.ts")).toMatchSnapshot();
    expect(read(tree, "apps/web/src/components/Counter.test.tsx")).toMatchSnapshot();
    expect(read(tree, "apps/web/README.md")).toContain("`nx build web`");
    expect(readProjectConfiguration(tree, "web").root).toBe("apps/web");
  });

  test("every starter gets its own first test", async () => {
    const tests: Record<string, string> = {
      static: "src/components/Counter.test.tsx",
      server: "src/routes/index.server.test.tsx",
      ui: "src/components/LikeButton.server.test.tsx",
      minimal: "src/routes/index.test.tsx",
    };
    for (const [template, file] of Object.entries(tests)) {
      const tree = await app(template as "static");
      expect(tree.exists(`apps/web/${file}`), template).toBe(true);
    }
  });

  test("server starter keeps serve.js + Dockerfile, mode stays node", async () => {
    const tree = await app("server");
    expect(tree.exists("apps/web/serve.js")).toBe(true);
    expect(tree.exists("apps/web/Dockerfile")).toBe(true);
    expect(read(tree, "apps/web/vite.config.ts")).not.toContain('mode: "static"');
  });

  test("--adapter=node on a static starter: no prerender, the server starter's serve.js", async () => {
    const tree = await app("static", { adapter: "node" });
    expect(read(tree, "apps/web/vite.config.ts")).toMatchSnapshot();
    expect(tree.exists("apps/web/prerender.js")).toBe(false);
    expect(read(tree, "apps/web/serve.js")).toContain('from "@rivetjs/router/node"');
    expect(read(tree, "apps/web/serve.js")).toContain("start(");
  });

  test("--no-tailwind on the static starter; --tailwind on the minimal one", async () => {
    const off = await app("static", { tailwind: false });
    expect(read(off, "apps/web/vite.config.ts")).toMatchSnapshot();
    expect(read(off, "apps/web/src/styles.css")).not.toContain("tailwind");
    expect(readJson(off, "apps/web/package.json").devDependencies["tailwindcss"]).toBeUndefined();
    const on = await app("minimal", { tailwind: true });
    expect(read(on, "apps/web/vite.config.ts")).toMatchSnapshot();
    expect(read(on, "apps/web/src/styles.css")).toContain('@import "tailwindcss"');
    expect(readJson(on, "apps/web/package.json").devDependencies["@tailwindcss/vite"]).toBeDefined();
  });

  test("--unitTestRunner=none: no vitest files or deps", async () => {
    const tree = await app("static", { unitTestRunner: "none" });
    expect(tree.exists("apps/web/vitest.config.ts")).toBe(false);
    expect(readJson(tree, "apps/web/package.json").devDependencies["vitest"]).toBeUndefined();
  });

  test("addPlugin false: targets written to project.json", async () => {
    const tree = await app("static", { addPlugin: false });
    const targets = readJson(tree, "apps/web/project.json").targets;
    expect(Object.keys(targets)).toEqual(["build", "dev", "preview", "test", "check", "typecheck"]);
    expect(targets.build.executor).toBe("@rivetjs/nx:build");
  });

  test("integrated workspace: app dependencies go to the root package.json; workspaces list gets the app", async () => {
    const tree = await app("ui");
    expect(readJson(tree, "package.json").dependencies["@rivetjs/ui"]).toBe(RIVET_NX_VERSION);
    const pkgBased = emptyWorkspace();
    pkgBased.write("package.json", JSON.stringify({ name: "@acme/source", workspaces: ["packages/*"] }));
    await applicationGenerator(pkgBased, { directory: "apps/web", skipInstall: true });
    const root = readJson(pkgBased, "package.json");
    expect(root.workspaces).toEqual(["packages/*", "apps/web"]);
    expect(root.dependencies?.["@rivetjs/router"]).toBeUndefined();
  });

  test("tags, name and errors", async () => {
    const tree = emptyWorkspace();
    await applicationGenerator(tree, { directory: "apps/site/", name: "marketing", tags: "scope:web, type:app", skipInstall: true });
    expect(readProjectConfiguration(tree, "marketing").tags).toEqual(["scope:web", "type:app"]);
    await expect(applicationGenerator(tree, { directory: "apps/other", name: "marketing" })).rejects.toThrow(/already exists/);
    await expect(applicationGenerator(tree, { directory: "apps/site" })).rejects.toThrow(/not empty/);
    await expect(applicationGenerator(tree, { directory: "apps/x", template: "ui", tailwind: false })).rejects.toThrow(/needs Tailwind/);
    await expect(applicationGenerator(tree, { directory: "apps/y", template: "server", adapter: "static" })).rejects.toThrow(/needs a server/);
  });
});

describe("application --deploy", () => {
  // create-rivet's overlay over the same starter, for comparison (same edits, same files).
  const viaCreateRivet = (template: "static" | "server", target: DeployTarget) => {
    const dir = mkdtempSync(join(tmpdir(), "rivet-nx-cr-"));
    try {
      const { dir: out } = createProject({ dir: join(dir, "web"), name: "web", template, rivetVersion: RIVET_NX_VERSION, overlays: [deployOverlay(target)] });
      return {
        config: readFileSync(join(out, "vite.config.ts"), "utf8"),
        gitignore: readFileSync(join(out, ".gitignore"), "utf8"),
        files: readdirSync(out).sort(),
      };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  test.each(["vercel", "netlify", "cloudflare", "bun", "deno"] as const)("%s: create-rivet's adapter, .gitignore and files; Nx targets", async (target) => {
    const tree = await app("server", { deploy: target, addPlugin: false, unitTestRunner: "none" });
    const expected = viaCreateRivet("server", target);
    expect(read(tree, "apps/web/vite.config.ts")).toBe(expected.config);
    expect(read(tree, "apps/web/.gitignore")).toBe(expected.gitignore);
    const ours = tree.children("apps/web").filter((file) => file !== "project.json");
    expect(ours.sort()).toEqual(expected.files);
    const pkg = readJson(tree, "apps/web/package.json");
    expect(pkg.scripts).toBeUndefined();
    expect(pkg.devDependencies["wrangler"] !== undefined).toBe(target === "cloudflare");
    const targets = readJson(tree, "apps/web/project.json").targets;
    expect({ deploy: targets.deploy?.options, preview: targets.preview.options, outputs: targets.build.outputs }).toMatchSnapshot();
    const readme = read(tree, "apps/web/README.md");
    expect(readme).toContain("## Deploy: ");
    expect(readme.slice(readme.indexOf("## Deploy: "))).not.toMatch(/npm run (build|deploy|preview|start)\b/);
  });

  test("netlify.toml builds through Nx; static starter keeps prerendering", async () => {
    const tree = await app("static", { deploy: "netlify" });
    expect(read(tree, "apps/web/netlify.toml")).toBe('[build]\n  command = "npx nx build web"\n  publish = "dist/netlify"\n');
    expect(read(tree, "apps/web/vite.config.ts")).toContain('rivetRouter({ adapter: "netlify", mode: "static"');
    expect(tree.exists("apps/web/prerender.js")).toBe(true);
  });

  test("errors: unknown target, bun / deno need the server starter", async () => {
    await expect(app("static", { deploy: "bun" })).rejects.toThrow(/--deploy bun runs a server: use --template server/);
    await expect(app("server", { deploy: "heroku" })).rejects.toThrow(/unknown deploy target "heroku"/);
  });
});

describe("preset", () => {
  test("workspaces + init + first app", async () => {
    const tree = emptyWorkspace();
    await presetGenerator(tree, { name: "acme", template: "minimal", skipInstall: true });
    expect(readJson(tree, "package.json").workspaces).toEqual(["apps/*", "libs/*"]);
    expect(readProjectConfiguration(tree, "acme").root).toBe("apps/acme");
    expect(tree.exists("apps/acme/src/routes/index.test.tsx")).toBe(true);
    expect(readNxJson(tree)!.plugins).toHaveLength(1);
  });
});

describe("library", () => {
  test("source exports per subpath, sideEffects false, vitest", async () => {
    const tree = emptyWorkspace();
    await libraryGenerator(tree, { directory: "libs/ui-kit", subpaths: "button, Date Picker", skipInstall: true });
    expect(filesUnder(tree, "libs/ui-kit")).toMatchSnapshot();
    const pkg = readJson(tree, "libs/ui-kit/package.json");
    expect(pkg).toMatchSnapshot();
    expect(read(tree, "libs/ui-kit/src/date-picker/DatePicker.tsx")).toMatchSnapshot();
    expect(readJson(tree, "libs/ui-kit/project.json").targets).toEqual({});
  });

  test("publishable: package build target + tsconfig.lib.json", async () => {
    const tree = emptyWorkspace();
    await libraryGenerator(tree, { directory: "libs/kit", publishable: true, importPath: "@acme/kit", skipInstall: true });
    const pkg = readJson(tree, "libs/kit/package.json");
    expect(pkg.private).toBeUndefined();
    expect(pkg.name).toBe("@acme/kit");
    expect(readJson(tree, "libs/kit/project.json").targets.build).toMatchSnapshot();
    expect(readJson(tree, "libs/kit/tsconfig.lib.json").compilerOptions.rewriteRelativeImportExtensions).toBe(true);
  });

  test("no tests: check + typecheck in project.json (inference finds libraries through their vitest config)", async () => {
    const tree = emptyWorkspace();
    await libraryGenerator(tree, { directory: "libs/plain", unitTestRunner: "none", skipInstall: true });
    expect(Object.keys(readJson(tree, "libs/plain/project.json").targets)).toEqual(["check", "typecheck"]);
  });
});

describe("component", () => {
  test("basic component + test in an app", async () => {
    const tree = await app("static");
    await componentGenerator(tree, { project: "web", name: "user-card" });
    expect(read(tree, "apps/web/src/components/UserCard.tsx")).toMatchSnapshot();
    expect(read(tree, "apps/web/src/components/UserCard.test.tsx")).toMatchSnapshot();
  });

  test("overlay: render-function children, inline handlers; story route", async () => {
    const tree = await app("static");
    await componentGenerator(tree, { project: "web", name: "Popover", kind: "overlay", story: true, directory: "overlays" });
    const source = read(tree, "apps/web/src/overlays/Popover.tsx");
    expect(source).toContain("children: Slot");
    expect(source).toContain("{props.children()}");
    expect(source).toMatchSnapshot();
    expect(read(tree, "apps/web/src/routes/stories/popover.tsx")).toMatchSnapshot();
  });

  test("library: exported from src/index.ts once", async () => {
    const tree = emptyWorkspace();
    await libraryGenerator(tree, { directory: "libs/kit", skipInstall: true });
    await componentGenerator(tree, { project: "kit", name: "Badge" });
    expect(read(tree, "libs/kit/src/index.ts")).toMatchSnapshot();
    expect(tree.exists("libs/kit/src/Badge.test.tsx")).toBe(true);
    await expect(componentGenerator(tree, { project: "kit", name: "Badge" })).rejects.toThrow(/already exists/);
    await expect(componentGenerator(tree, { project: "kit", name: "Other", story: true })).rejects.toThrow(/--story needs/);
  });
});

describe("route", () => {
  test("segments, params, names, URLs", () => {
    expect(routeSegments("/src/routes/blog/[slug].tsx")).toEqual(["blog", "[slug]"]);
    expect(routeSegments("blog/index")).toEqual(["blog"]);
    expect(() => routeSegments("a/b:c")).toThrow(/Invalid route segment/);
    expect(routeParams(["docs", "[[lang]]", "[...path]", "[id]"])).toEqual([
      { name: "lang", kind: "optional" },
      { name: "path", kind: "rest" },
      { name: "id", kind: "one" },
    ]);
    expect(routeComponentName(["blog", "[slug]"])).toBe("BlogSlug");
    expect(routeComponentName([])).toBe("Home");
    expect(routeUrl(["(shop)", "docs", "[[lang]]", "[...path]"])).toBe("/docs/:lang?/*path");
    expect(sampleEntry(routeParams(["[[lang]]"]))).toBeUndefined();
    expect(sampleEntry(routeParams(["[id]", "[...rest]"]))).toBe('{ id: "example", rest: "example/page" }');
  });

  test("static app: loader + guard + entries + folder layout", async () => {
    const tree = await app("static");
    await routeGenerator(tree, { project: "web", path: "blog/[slug]", loader: true, guard: true, layout: true });
    expect(read(tree, "apps/web/src/routes/blog/[slug].tsx")).toMatchSnapshot();
    expect(read(tree, "apps/web/src/routes/blog/_layout.tsx")).toMatchSnapshot();
    await expect(routeGenerator(tree, { project: "web", path: "blog/[slug]" })).rejects.toThrow(/already exists/);
    await expect(routeGenerator(tree, { project: "web", path: "contact", action: true })).rejects.toThrow(/need a server/);
  });

  test("server app: action form, plain page, index of a group", async () => {
    const tree = await app("server");
    await routeGenerator(tree, { project: "web", path: "contact", action: true });
    expect(read(tree, "apps/web/src/routes/contact.tsx")).toMatchSnapshot();
    await routeGenerator(tree, { project: "web", path: "(marketing)/pricing/index" });
    expect(read(tree, "apps/web/src/routes/(marketing)/pricing/index.tsx")).toMatchSnapshot();
    await routeGenerator(tree, { project: "web", path: "docs/[[lang]]/[...path]" });
    expect(read(tree, "apps/web/src/routes/docs/[[lang]]/[...path].tsx")).toContain("params.path");
  });

  test("not an app", async () => {
    const tree = emptyWorkspace();
    await libraryGenerator(tree, { directory: "libs/kit", skipInstall: true });
    await expect(routeGenerator(tree, { project: "kit", path: "x" })).rejects.toThrow(/not a Rivet app/);
  });
});

describe("layout", () => {
  test("guarded group layout; root layout exists already", async () => {
    const tree = await app("server");
    await layoutGenerator(tree, { project: "web", directory: "(private)", guard: true });
    expect(read(tree, "apps/web/src/routes/(private)/_layout.tsx")).toMatchSnapshot();
    await layoutGenerator(tree, { project: "web" });
    expect(read(tree, "apps/web/src/routes/_layout.tsx")).toContain("export default function RootLayout");
    await expect(layoutGenerator(tree, { project: "web" })).rejects.toThrow(/already exists/);
  });
});

describe("api-route", () => {
  test("handlers per method; static apps refused", async () => {
    const tree = await app("server");
    await apiRouteGenerator(tree, { project: "web", path: "api/items/[id]", methods: ["get", "post", "delete"] });
    expect(read(tree, "apps/web/src/routes/api/items/[id].ts")).toMatchSnapshot();
    await apiRouteGenerator(tree, { project: "web", path: "api/health" });
    expect(read(tree, "apps/web/src/routes/api/health.ts")).toContain("export const onGet");
    await expect(apiRouteGenerator(tree, { project: "web", path: "api/x", methods: ["trace" as "get"] })).rejects.toThrow(/unknown method/);
    const site = await app("static");
    await expect(apiRouteGenerator(site, { project: "web", path: "api/health" })).rejects.toThrow(/need a server/);
  });
});

describe("ui-setup", () => {
  test("Tailwind + ui styles + deps on the minimal starter; idempotent", async () => {
    const tree = await app("minimal");
    await uiSetupGenerator(tree, { project: "web" });
    await uiSetupGenerator(tree, { project: "web" });
    expect(read(tree, "apps/web/vite.config.ts")).toMatchSnapshot();
    expect(read(tree, "apps/web/src/styles.css")).toMatchSnapshot();
    expect(readJson(tree, "package.json").dependencies["@rivetjs/ui"]).toBe(RIVET_NX_VERSION);
  });

  test("styles: after the tailwind import; idempotent", () => {
    expect(uiStyles('@import "tailwindcss";\nbody {}\n')).toBe('@import "tailwindcss";\n@import "@rivetjs/ui/styles";\nbody {}\n');
    expect(uiStyles('@import "tailwindcss";\n@import "@rivetjs/ui/styles";\n')).toBe('@import "tailwindcss";\n@import "@rivetjs/ui/styles";\n');
  });
});

describe("i18n-setup", () => {
  test("config, catalogs, plugin first, gitignored dts", async () => {
    const tree = await app("server");
    await i18nSetupGenerator(tree, { project: "web", locales: "en,de", prefix: "always" });
    expect(read(tree, "apps/web/i18n.config.ts")).toMatchSnapshot();
    expect(read(tree, "apps/web/vite.config.ts")).toMatchSnapshot();
    expect(readJson(tree, "apps/web/locales/de.json")).toMatchSnapshot();
    expect(read(tree, "apps/web/.gitignore")).toContain("src/rivet-i18n.d.ts");
    await expect(i18nSetupGenerator(tree, { project: "web" })).rejects.toThrow(/already exists/);
    const other = await app("static");
    await expect(i18nSetupGenerator(other, { project: "web", locales: "en", defaultLocale: "fr" })).rejects.toThrow(/not in locales/);
  });
});
