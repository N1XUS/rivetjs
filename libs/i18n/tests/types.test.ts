import { test } from "vitest";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { declarations } from "../types.ts";
import { buildTable } from "../catalog.ts";

const { table } = buildTable(
  { locales: ["en"], defaultLocale: "en", catalogs: "x" },
  {
    en: {
      hi: "Hi",
      cart: { count: "{n, plural, one {# item} other {# items}}" },
      who: "{g, select, f {she} m {he} other {they}}",
      terms: "Read <link>terms</link>",
      bold: "Read <b>this</b> <link>now</link>",
      nav: { home: "Home", about: "About" },
      when: "{d, date, short} by {name}",
    },
  },
);

test("declarations type keys and params", () => {
  const text = declarations(table, ["en"]);
  assert.match(text, /declare module "@rivetjs\/i18n"/);
  assert.match(text, /"hi": \{\}/);
  assert.match(text, /"cart\.count": \{ n: number \}/);
  assert.match(text, /"who": \{ g: "f" \| "m" \| \(string & \{\}\) \}/);
  assert.match(text, /^import type \{ Content \} from "@rivetjs\/runtime\/jsx-runtime";$/m);
  assert.match(text, /"terms": \{ link: \(children: Content\) => Content \}/);
  assert.match(text, /"bold": \{ b\?: \(children: Content\) => Content; link: \(children: Content\) => Content \}/);
  assert.match(text, /"when": \{ d: Date \| number; name: string \| number \}/);
  assert.match(text, /"en": true/);
});

test("declarations without tags import nothing", () => {
  const { table: plain } = buildTable({ locales: ["en"], defaultLocale: "en", catalogs: "x" }, { en: { hi: "Hi" } });
  assert.doesNotMatch(declarations(plain, ["en"]), /import/);
});

test("generated declarations type keys, params and results under tsc", () => {
  const dir = mkdtempSync(join(tmpdir(), "rivet-i18n-"));
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  writeFileSync(join(dir, "package.json"), `{ "type": "module" }`);
  writeFileSync(join(dir, "i18n.d.ts"), declarations(table, ["en"]));
  writeFileSync(
    join(dir, "use.tsx"),
    [
      `import { t, type Locale } from "@rivetjs/i18n";`,
      `import type { Content } from "@rivetjs/runtime/jsx-runtime";`,
      `const id: string = "home";`,
      `const s: string = t("hi");`,
      `const terms: Content = t("terms", { link: (c) => <a href="/terms">{c}</a> });`,
      `const bold: Content = t("bold", { link: (c) => <i>{c}</i> });`,
      `const nav: string = t(\`nav.\${id}\`);`,
      `const inl: string = t.in("en", "hi");`,
      `// @ts-expect-error a message with tags is content, not a string`,
      `const notString: string = t("terms", { link: (c) => c });`,
      `// @ts-expect-error unknown namespace`,
      `t(\`nope.\${id}\`);`,
      `// @ts-expect-error a literal key under a namespace is checked as a key`,
      `t("nav.typo");`,
      `// @ts-expect-error prefixed keys take no params`,
      `t(\`nav.\${id}\`, {});`,
      `t("hi");`,
      `t("cart.count", { n: 1 });`,
      `t.in("en", "who", { g: "f" });`,
      `const l: Locale = "en";`,
      `// @ts-expect-error unknown key`,
      `t("nope");`,
      `// @ts-expect-error missing param`,
      `t("cart.count");`,
      `// @ts-expect-error wrong param type`,
      `t("cart.count", { n: "1" });`,
      `// @ts-expect-error unknown locale`,
      `const x: Locale = "fr";`,
      `export { l, x, s, terms, bold, nav, inl, notString };`,
      ``,
    ].join("\n"),
  );
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify({
      extends: join(root, "tsconfig.base.json"),
      compilerOptions: {
        paths: { "@rivetjs/i18n": [join(root, "libs/i18n/index.ts")], "@rivetjs/runtime/*": [join(root, "libs/runtime/*.ts")] },
        typeRoots: [join(root, "node_modules/@types")],
      },
      include: ["*.ts", "*.tsx"],
    }),
  );
  // Throws on any error, including an unused @ts-expect-error.
  execFileSync(join(root, "node_modules/.bin/tsc"), ["-p", dir], { stdio: "pipe", encoding: "utf8" });
});
