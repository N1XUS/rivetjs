// AI outputs (tools/llms): docs Markdown → plain Markdown, file layout, and the real apps/docs site end to end.
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ApiSymbol } from "../tools/api.ts";
import { generateLlms, llmsDigest, llmsProblems, mdFileOf } from "../tools/llms/generate.ts";
import { fence, llmsMarkdown, type LlmsMarkdownContext } from "../tools/llms/markdown.ts";
import { loadLlmsSource } from "../tools/llms/source.ts";

const symbol: ApiSymbol = {
  key: "@rivetjs/reactivity#signal",
  entry: "@rivetjs/reactivity",
  name: "signal",
  kind: "function",
  summary: "Create a signal.",
  remarks: "",
  signatures: ["function signal<T>(value: T): Signal<T>"],
  params: [],
  members: [],
  runsOn: "both",
  status: "stable",
  examples: [],
  source: { file: "x.ts", line: 1, url: "" },
  href: "/api/rivetjs/reactivity/signal/",
};
const context: LlmsMarkdownContext = {
  path: "guides/a",
  examples: new Map([
    [
      "counter",
      {
        id: "counter",
        title: "Counter",
        summary: "A button.",
        tags: [],
        files: [{ path: "src/routes/index.tsx", text: "export default () => <b>```</b>;\n" }],
        usedOn: [],
      },
    ],
  ]),
  symbols: new Map([[symbol.key, [symbol]]]),
  charts: new Map(),
  sites: { cdk: "https://cdk.example" },
  pages: new Set(["/guides/b/"]),
  link: ({ href, kind }) => (kind === "page" ? "https://docs.example/" + mdFileOf(href) : kind === "site" ? "https://docs.example" + href : href),
};

describe("llmsMarkdown", () => {
  it("keeps prose byte for byte and rewrites only docs syntax", () => {
    const body = "Some *prose* with `code` and a [link](./b.md#x), a [sibling](site:cdk/components/), an [api page](/api/x/).\n";
    expect(llmsMarkdown(body, context)).toBe(
      "Some *prose* with `code` and a [link](https://docs.example/guides/b.md#x), a [sibling](https://cdk.example/components/), an [api page](https://docs.example/api/x/).\n",
    );
  });
  it("inlines examples as fenced source (fence longer than any backtick run)", () => {
    const out = llmsMarkdown("::example{id=counter}\n", context);
    expect(out).toContain("**Example: Counter.** A button.");
    expect(out).toContain('````tsx title="src/routes/index.tsx"\nexport default () => <b>```</b>;\n````');
  });
  it("renders api cards, terms, kbd and callouts", () => {
    const out = llmsMarkdown(':::tip[Use it]\nPress :kbd[Esc] for a :term[signal].\n:::\n\n::api{symbol="@rivetjs/reactivity#signal"}\n', context);
    expect(out).toContain("> **Tip: Use it.**\n>\n> Press `Esc` for a signal.");
    expect(out).toContain("**API: `signal`** from `@rivetjs/reactivity` — Create a signal. ([reference](https://docs.example/api/rivetjs/reactivity/signal/))");
    expect(out).toContain("```ts\nfunction signal<T>(value: T): Signal<T>\n```");
  });
  it("indents multi-line replacements inside list items", () => {
    const out = llmsMarkdown("- item\n\n  ::example{id=counter}\n", context);
    expect(out).toContain('\n  ````tsx title="src/routes/index.tsx"\n  export default');
  });
  it("leaves directives inside code untouched and fails on unknown references", () => {
    expect(llmsMarkdown("```md\n::example{id=nope}\n```\n", context)).toBe("```md\n::example{id=nope}\n```\n");
    expect(() => llmsMarkdown("::example{id=nope}\n", context)).toThrow(/unknown example "nope"/);
  });
  it("fence picks a longer run", () => {
    expect(fence("a ```` b", "ts")).toBe("`````ts\na ```` b\n`````");
  });
});

describe("mdFileOf", () => {
  it("maps page hrefs to Markdown files", () => {
    expect(mdFileOf("/")).toBe("index.md");
    expect(mdFileOf("/guides/components/")).toBe("guides/components.md");
    expect(mdFileOf("/guides/components/#x")).toBe("guides/components.md#x");
  });
});

describe("apps/docs", () => {
  const root = resolve(import.meta.dirname, "../../../apps/docs");
  it("every page has Markdown, links resolve, output is deterministic, no docs syntax is left", { timeout: 60_000 }, async () => {
    const source = await loadLlmsSource(root);
    const output = await generateLlms(root);
    expect(llmsProblems(output, source)).toEqual([]);
    expect(llmsDigest(await generateLlms(root))).toBe(llmsDigest(output));
    const index = output.files.get("llms.txt")!;
    expect(index.startsWith(`# ${source.site.name}\n\n> `)).toBe(true);
    expect(index).toContain("## API reference");
    for (const page of source.pages) expect(index).toContain(mdFileOf(page.href));
    const full = output.files.get("llms-full.txt")!;
    for (const doc of output.docs.filter((doc) => doc.kind === "page")) {
      expect(full).toContain(`# ${doc.title}\n`);
      // Outside fences: no directive or site: link left.
      const prose = doc.markdown.replace(/^(`{3,})[^\n]*\n[\s\S]*?\n\1$/gm, "");
      expect(prose, doc.file).not.toMatch(/^:{2,3}[a-z]|\]\(site:|:term\[|:kbd\[/m);
    }
  });
});
