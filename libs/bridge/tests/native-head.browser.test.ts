import { afterEach, beforeEach, expect, test } from "vitest";
import { applyRouteHead } from "../../kit/dom.ts";
import { discardNativeHead, withNativeHead } from "../head-client.ts";
import { installNativeHeadLifecycle, nativeHeadLifecycle } from "../head-lifecycle.ts";

const range = (framework: string, id: string, html: string) => `<!--rivet-head:${framework}:${id}-->${html}<!--/rivet-head:${framework}:${id}-->`;
let initialHead: Set<Node>, removedTitles: HTMLTitleElement[];
beforeEach(() => {
  initialHead = new Set(document.head.childNodes);
  removedTitles = [...document.head.querySelectorAll("title")];
  for (const title of removedTitles) title.remove();
});
afterEach(async () => {
  document.body.innerHTML = "";
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  for (const node of [...document.head.childNodes]) if (!initialHead.has(node)) node.remove();
  for (const title of removedTitles) document.head.append(title);
});
const owner = (id: string) => {
  const root = document.createElement("rivet-island");
  root.setAttribute("data-ri", id);
  document.body.append(root);
  return root;
};
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

test("static native SSR metadata cleans up on real Kit navigation; the next route title survives old-range removal", async () => {
  const root = owner("i0");
  document.head.insertAdjacentHTML("beforeend", range("svelte", "i0", '<!--hash--><meta name="description" content="old"><!----><title>Old</title>'));
  installNativeHeadLifecycle(document);
  expect(document.title).toBe("Old");
  applyRouteHead({ data: [], head: { title: "Next", meta: [{ name: "description", content: "next" }] } });
  root.remove();
  await tick();
  expect([...document.head.querySelectorAll('meta[name="description"]')].map((meta) => meta.getAttribute("content"))).toEqual(["next"]);
  expect(document.title).toBe("Next");
  expect(document.head.querySelectorAll("title")).toHaveLength(1);
});

test("ownership follows the original root identity; a new route reusing its SSR id cannot keep old head alive", async () => {
  const old = owner("i0");
  document.head.insertAdjacentHTML("beforeend", range("svelte", "i0", '<!--hash--><meta name="old-owner" content="old"><!---->'));
  installNativeHeadLifecycle(document);
  owner("i0");
  old.remove();
  await tick();
  expect(document.head.querySelector('meta[name="old-owner"]')).toBeNull();
});

test("kept or synchronously moved roots preserve identical stylesheet/style nodes during hydration and navigation", async () => {
  const root = owner("i0");
  document.head.insertAdjacentHTML(
    "beforeend",
    range("svelte", "i0", '<!--hash--><link rel="stylesheet" href="data:text/css,body%7Bcolor:red%7D"><style>body{--native-head:1}</style><!---->'),
  );
  const link = document.head.querySelector('link[href^="data:text/css"]')!,
    style = document.head.querySelector("style:last-of-type") as HTMLStyleElement;
  const sheet = style.sheet;
  installNativeHeadLifecycle(document);
  withNativeHead("svelte", "i0", () => {
    expect(link.parentNode).toBe(document.head);
    expect(style.sheet).toBe(sheet);
  });
  root.remove();
  document.body.append(root);
  await tick();
  expect(link.parentNode).toBe(document.head);
  expect(style.sheet).toBe(sheet);
  root.remove();
  await tick();
  expect(link.isConnected).toBe(false);
  expect(style.isConnected).toBe(false);
});

test("serialized nonced lifecycle bootstrap is self-contained and hydrates no framework code", async () => {
  const root = owner("i7");
  document.head.insertAdjacentHTML(
    "beforeend",
    range("vue", "i7", '<!--teleport start anchor--><meta name="bootstrap-owner" content="old"><!--teleport anchor-->'),
  );
  const html = nativeHeadLifecycle("test-nonce");
  expect(html).toContain('nonce="test-nonce"');
  const script = document.createElement("script");
  script.nonce = "test-nonce";
  script.textContent = html.slice(html.indexOf(">") + 1, html.lastIndexOf("</script>"));
  document.head.append(script);
  root.remove();
  await tick();
  expect(document.head.querySelector('meta[name="bootstrap-owner"]')).toBeNull();
});

test("failed native head adoption can discard only its own range before a fresh mount", async () => {
  owner("i0");
  owner("i1");
  document.head.insertAdjacentHTML(
    "beforeend",
    range("vue", "i0", '<!--teleport start anchor--><meta name="retry" content="failed"><!--teleport anchor-->') +
      range("vue", "i1", '<!--teleport start anchor--><meta name="kept" content="kept"><!--teleport anchor-->'),
  );
  const kept = document.head.querySelector('meta[name="kept"]');
  installNativeHeadLifecycle(document);
  await expect(
    withNativeHead("vue", "i0", async () => {
      throw new Error("async setup failed");
    }),
  ).rejects.toThrow("async setup failed");
  discardNativeHead("vue", "i0");
  expect(document.head.querySelector('meta[name="retry"]')).toBeNull();
  expect(document.head.querySelector('meta[name="kept"]')).toBe(kept);
  expect([...document.head.childNodes].filter((node) => node.nodeType === 8 && (node as Comment).data === "teleport start anchor")).toHaveLength(1);
});
