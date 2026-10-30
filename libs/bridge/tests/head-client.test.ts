import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Window } from "happy-dom";
import { withNativeHead } from "../head-client.ts";
import { nativeHead } from "../head.ts";
import { headTags, rankMerge } from "../../router/shared/head.ts";

let win: Window;
beforeEach(() => {
  win = new Window({ url: "https://test.local" });
  vi.stubGlobal("document", win.document);
});
afterEach(async () => {
  await win.happyDOM.abort();
  vi.unstubAllGlobals();
});
const range = (framework: string, id: string, html: string) => `<!--rivet-head:${framework}:${id}-->${html}<!--/rivet-head:${framework}:${id}-->`;
const comment = (value: string) => [...document.head.childNodes].find((node) => node.nodeType === 8 && (node as Comment).data === value) as Comment;

function consumeSvelteHash() {
  const marker = comment("same-hash");
  const meta = marker.nextSibling!;
  marker.remove();
  return meta;
}

test("Svelte same-hash islands hydrate out of SSR order with identical resource nodes, hiding only native comments", () => {
  document.head.innerHTML =
    range("svelte", "i0", '<!--same-hash--><meta name="x" content="first"><link rel="stylesheet" href="/a.css"><!---->') +
    range("svelte", "i1", '<!--same-hash--><meta name="x" content="second"><style>body{color:red}</style><!---->');
  const [first, second] = [...document.head.querySelectorAll("meta")];
  const sheet = document.head.querySelector("link")!,
    style = document.head.querySelector("style")!;
  const firstMarker = comment("same-hash");
  const found = withNativeHead("svelte", "i1", (native) => {
    expect(native).toBe(true);
    expect(sheet.parentNode).toBe(document.head);
    expect(style.parentNode).toBe(document.head);
    expect(firstMarker.data).toBe("rivet-head-hidden");
    return consumeSvelteHash();
  });
  expect(found).toBe(second);
  expect(firstMarker.data).toBe("same-hash");
  expect(withNativeHead("svelte", "i0", consumeSvelteHash)).toBe(first);
  expect(sheet.parentNode).toBe(document.head);
  expect(style.parentNode).toBe(document.head);
});

test("async hydration holds marker scope, serializes another island, and restores in finally after rejection", async () => {
  document.head.innerHTML =
    range("svelte", "i0", '<!--same-hash--><meta name="x" content="first"><!---->') +
    range("svelte", "i1", '<!--same-hash--><meta name="x" content="second"><!---->');
  let release!: () => void;
  const pause = new Promise<void>((resolve) => {
    release = resolve;
  });
  let secondStarted = false;
  const first = withNativeHead("svelte", "i0", async () => {
    await pause;
    throw new Error("async head failure");
  });
  const second = withNativeHead("svelte", "i1", () => {
    secondStarted = true;
    return consumeSvelteHash();
  });
  expect(secondStarted).toBe(false);
  expect(comment("same-hash").nextSibling).toBe(document.head.querySelector('meta[content="first"]'));
  release();
  await expect(first).rejects.toThrow("async head failure");
  expect(await second).toBe(document.head.querySelector('meta[content="second"]'));
  expect(secondStarted).toBe(true);
  expect(comment("same-hash").nextSibling).toBe(document.head.querySelector('meta[content="first"]'));
});

test("Vue hydration scopes its private cursor, preserves markers and restores the previous cursor", () => {
  const teleport = (value: string) => `<!--teleport start anchor--><meta name="x" content="${value}"><!--teleport anchor-->`;
  document.head.innerHTML = range("vue", "i0", teleport("first")) + range("vue", "i1", teleport("second"));
  const head = document.head as HTMLHeadElement & { _lpa?: Node };
  const initial = document.createTextNode("prior");
  head.append(initial);
  head._lpa = initial;
  const second = head.querySelector('meta[content="second"]')!;
  const result = withNativeHead("vue", "i1", () => {
    const first = head._lpa!;
    expect((first as Comment).data).toBe("teleport start anchor");
    expect(first.nextSibling).toBe(second);
    head._lpa = second.nextSibling!.nextSibling!;
    return second;
  });
  expect(result).toBe(second);
  expect(head._lpa).toBe(initial);
  expect([...head.childNodes].filter((node) => node.nodeType === 8 && (node as Comment).data === "teleport start anchor")).toHaveLength(2);
});

test("a Vue version that ignores the private cursor fails loudly and releases its scope", () => {
  document.head.innerHTML = range("vue", "i0", '<!--teleport start anchor--><meta name="x" content="one"><!--teleport anchor-->');
  expect(() => withNativeHead("vue", "i0", () => "ignored")).toThrow(/cursor.*unsupported/);
  expect((document.head as any)._lpa).toBeUndefined();
  expect(withNativeHead("svelte", "absent", (native) => native)).toBe(false);
});

test("one native title replaces a lower-ranked route title and remains the actual document.title through hydration", () => {
  const raw = '<!--hash--><meta name="description" content="native"><!----><title>Native &amp; title</title>';
  const merged = rankMerge([
    { level: 0, phase: 0, seq: 0, head: { title: "Route", meta: [{ name: "theme-color", content: "blue" }] } },
    { level: 0, phase: 1, seq: 1, head: nativeHead("svelte", "i0", raw).head! },
  ]);
  document.head.innerHTML = headTags(merged);
  expect(document.title).toBe("Native & title");
  expect(document.head.querySelectorAll("title")).toHaveLength(1);
  withNativeHead("svelte", "i0", () => {
    document.title = "Native & title";
  });
  expect(document.title).toBe("Native & title");
  expect(document.head.querySelectorAll("title")).toHaveLength(1);
});
