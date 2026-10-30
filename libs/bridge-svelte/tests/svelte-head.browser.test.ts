import { afterEach, expect, test, vi } from "vitest";
import { createRoot } from "@rivetjs/reactivity";
import { hydrateIsland } from "@rivetjs/bridge/client";
import type { ClientAdapter } from "@rivetjs/bridge/adapter";
import { settled } from "svelte";
import { adapter } from "../client.ts";
import Head from "./fixtures/Head.svelte";
import Metadata from "./fixtures/Metadata.svelte";
import { headBodyHtml, rawHeadHtml, metadataoneHtml, metadataoneHead, metadatatwoHtml, metadatatwoHead } from "./fixtures/html.ts";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  vi.restoreAllMocks();
});
function head(id: string, raw: string) {
  const template = document.createElement("template");
  template.innerHTML = "<!--rivet-head:svelte:" + id + "-->" + raw + "<!--/rivet-head:svelte:" + id + "-->";
  const nodes = [...template.content.childNodes];
  document.head.append(template.content);
  cleanups.push(() => nodes.forEach((node) => node.parentNode?.removeChild(node)));
}
function root(body: string): Element {
  const element = document.createElement("rivet-island");
  element.innerHTML = body;
  document.body.append(element);
  cleanups.push(() => element.remove());
  return element;
}

test("native svelte:head preserves SSR meta/link nodes exactly once and removes them on unmount", async () => {
  const existingTitles = [...document.head.querySelectorAll("title")];
  existingTitles.forEach((title) => title.remove());
  cleanups.push(() => document.head.append(...existingTitles));
  head("i0", rawHeadHtml);
  const meta = document.head.querySelector('meta[name="description"][content="Svelte & Rivet"]')!;
  const link = document.head.querySelector('link[rel="canonical"][href="https://example.com/"]')!;
  const handle = await adapter.hydrate(root(headBodyHtml), Head, {}, {}, { id: "i0" });
  let mounted = true;
  cleanups.push(() => {
    if (mounted) adapter.unmount(handle);
  });
  expect(document.head.querySelectorAll('meta[name="description"][content="Svelte & Rivet"]')).toHaveLength(1);
  expect(document.head.querySelector('meta[name="description"][content="Svelte & Rivet"]')).toBe(meta);
  expect(document.head.querySelector('link[rel="canonical"][href="https://example.com/"]')).toBe(link);
  expect(document.head.querySelectorAll("title")).toHaveLength(1);
  expect(document.title).toBe("Svelte & Rivet");
  adapter.unmount(handle);
  mounted = false;
  expect(meta.isConnected).toBe(false);
  expect(link.isConnected).toBe(false);
});

test("same SFC head ranges hydrate out of SSR order, keep separate live props and clean up independently", async () => {
  head("i0", metadataoneHead);
  head("i1", metadatatwoHead);
  const [one, two] = [...document.head.querySelectorAll('meta[name="svelte-island"]')];
  const oneRoot = root(metadataoneHtml),
    twoRoot = root(metadatatwoHtml);
  // i1 can be load while i0 waits for interaction: marker scopes must not attach i1 to i0's identical head hash.
  const second = await adapter.hydrate(twoRoot, Metadata, { label: "two" }, {}, { id: "i1" });
  const first = await adapter.hydrate(oneRoot, Metadata, { label: "one" }, {}, { id: "i0" });
  let firstMounted = true,
    secondMounted = true;
  cleanups.push(() => {
    if (firstMounted) adapter.unmount(first);
    if (secondMounted) adapter.unmount(second);
  });
  expect(document.head.querySelectorAll('meta[name="svelte-island"]')).toHaveLength(2);
  adapter.update(second, { label: "changed" });
  await settled();
  expect(one!.getAttribute("content")).toBe("one");
  expect(two!.getAttribute("content")).toBe("changed");
  adapter.unmount(first);
  firstMounted = false;
  expect(one!.isConnected).toBe(false);
  expect(two!.isConnected).toBe(true);
  adapter.unmount(second);
  secondMounted = false;
  expect(two!.isConnected).toBe(false);
});

test("failed head hydration mounts once, discards only its own SSR head and preserves unrelated resources", async () => {
  head("i0", metadataoneHead);
  head("i1", metadatatwoHead);
  const old = document.head.querySelector('meta[name="svelte-island"][content="one"]')!;
  const other = document.head.querySelector('meta[name="svelte-island"][content="two"]')!;
  const style = document.createElement("style");
  style.textContent = "body { --svelte-unrelated-head: 1; }";
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "data:text/css,body%7B--svelte-unrelated-resource%3A1%7D";
  document.head.append(style, link);
  cleanups.push(() => {
    style.remove();
    link.remove();
  });
  // Missing the body hydration markers makes Svelte fail before it claims the real Metadata.svelte head range.
  const element = root("<p>broken server body</p>");
  element.setAttribute("data-ri", "i0");
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const mount = vi.fn(adapter.mount);
  const owner = createRoot(() =>
    hydrateIsland(
      () => Promise.resolve({ default: Metadata, adapter: { ...adapter, mount } as ClientAdapter }),
      element,
      { label: "one" },
      { id: "i0", on: "load" },
    ),
  );
  let disposed = false;
  cleanups.push(() => {
    if (!disposed) owner.dispose();
  });
  const until = async (check: () => boolean) => {
    const end = performance.now() + 3000;
    while (!check()) {
      if (performance.now() > end) throw new Error("timed out");
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  };
  await until(() => element.querySelector("p")?.textContent === "one");
  expect(mount).toHaveBeenCalledTimes(1);
  expect(errors.mock.calls.filter((call) => String(call[0]).includes("RV2149"))).toHaveLength(1);
  expect(old.isConnected).toBe(false);
  expect(document.head.querySelectorAll('meta[name="svelte-island"][content="one"]')).toHaveLength(1);
  expect(document.head.querySelector('meta[name="svelte-island"][content="two"]')).toBe(other);
  expect(other.isConnected).toBe(true);
  expect(style.isConnected).toBe(true);
  expect(style.textContent).toBe("body { --svelte-unrelated-head: 1; }");
  expect(link.isConnected).toBe(true);
  expect(link.getAttribute("href")).toBe("data:text/css,body%7B--svelte-unrelated-resource%3A1%7D");
  owner.dispose();
  disposed = true;
  await until(() => !document.head.querySelector('meta[name="svelte-island"][content="one"]'));
  expect(other.isConnected).toBe(true);
  expect(style.isConnected).toBe(true);
  expect(link.isConnected).toBe(true);
});
