// Cross-site links: `site:<name>/<path>` resolves against the site config `sites`; hard-coded localhost links are collected.
import { expect, test } from "vitest";
import { isLocalUrl, renderMarkdown, siteHref } from "../tools/content/markdown.ts";

const sites = { cdk: "https://cdk.example.com/" };
const context = (extra = {}) => ({
  path: "ui/overview",
  highlight: ((code: string) => code) as never,
  terms: new Map(),
  examples: new Set<string>(),
  starters: new Set<string>(),
  sites,
  ...extra,
});

test("siteHref resolves against the configured origin", () => {
  expect(siteHref("site:cdk/components/overview/", sites)).toBe("https://cdk.example.com/components/overview/");
  expect(siteHref("site:cdk", sites)).toBe("https://cdk.example.com/");
  expect(() => siteHref("site:nope/x/", sites)).toThrow(/unknown site "nope"/);
});

test("renderMarkdown rewrites site: links and reports local links", () => {
  const out = renderMarkdown("[a](site:cdk/x/) [b](http://127.0.0.1:4323/y/) [c](https://example.com)", context());
  expect(out.jsx).toContain('href="https://cdk.example.com/x/"');
  expect(out.localLinks).toEqual(["http://127.0.0.1:4323/y/"]);
  expect(() => renderMarkdown("[a](site:zzz/x/)", context())).toThrow(/ui\/overview\.md.*unknown site/);
});

test("isLocalUrl", () => {
  for (const url of ["http://localhost:3000", "http://127.0.0.1/", "https://[::1]:80/a"]) expect(isLocalUrl(url)).toBe(true);
  for (const url of ["https://localhost.example.com", "https://example.com/127.0.0.1"]) expect(isLocalUrl(url)).toBe(false);
});
