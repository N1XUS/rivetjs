// Regenerate resume-loader-derived.min.ts from resume-loader-derived.ts: node libs/runtime/build-loader.ts
// Sources are serialized with Function#toString: Node's type stripping leaves whitespace where
// annotations were, and esbuild's minifier normalizes it, so the output is independent of types.
// The resume-loader test fails when the generated file is stale.
import { writeFile } from "node:fs/promises";
import { transform } from "esbuild";
import { derivedDrag, derivedFetchLater, derivedLoader, derivedStream, derivedVisibleBoot } from "./resume-loader-derived.ts";

const minify = async (fn: () => void): Promise<string> => (await transform("(" + fn + ")()", { minify: true, target: "es2020" })).code.trim();
/** Minified inline loader, shipped after the boundaries tail. */
export const minifiedDerived = (): Promise<string> => minify(derivedLoader);
/** The loader's minified `data-boot` start (`<script>.hasAttribute("data-boot")&&<boot>(1).catch(<fail>)`). */
const START = /(\w+)\.hasAttribute\("data-boot"\)&&(\w+)\(1\)\.catch\((\w+)\)/;
/**
 * ZERO ABI-SPLIT: the visible-boot loader (pages whose only triggers are `visible` ones, `data-boot="<ids>"`) = the loader
 * with its `data-boot` start made `s.dataset.boot ? (derivedVisibleBoot)(s, boot, fail) : <start>` — spliced into the
 * minified loader, so every other page's loader stays the same bytes. Returns [splice index, inserted text].
 */
export const visibleSplice = async (loader: string): Promise<[number, string]> => {
  const hit = START.exec(loader);
  if (!hit) throw Error("build-loader: no data-boot start in the minified loader");
  const [, script, boot, fail] = hit;
  const fn = (await transform("(" + derivedVisibleBoot + ")(__s,__b,__f);", { minify: true, target: "es2020" })).code.trim().replace(/;$/, "");
  return [hit.index, script + ".dataset.boot?" + fn.replace("(__s,__b,__f)", "(" + script + "," + boot + "," + fail + ")") + ":"];
};
/** The visible-boot loader (`DERIVED_LOADER_VISIBLE`). */
export const minifiedDerivedVisible = async (): Promise<string> => {
  const loader = await minifiedDerived(),
    [at, text] = await visibleSplice(loader);
  return loader.slice(0, at) + text + loader.slice(at);
};
/** The loader's minified fetch-ahead link loop (`<fo>.split(" ").map(<h>=><d>.head.append(Object.assign(…)))`). */
const AHEAD =
  /(\w+)\.split\(" "\)\.map\((\w+)=>(\w+)\.head\.append\(Object\.assign\(\3\.createElement\("link"\),\{rel:"modulepreload",href:\2,fetchPriority:(\w+)\|\|"low"\}\)\)\)/;
/**
 * IDLE-PREFETCH: the lazy-part loader (pages with `data-fl`) = the loader with its fetch-ahead link loop replaced by
 * `(derivedFetchLater)(<script>, <fo>, <priority>)`, spliced into the minified loader like `visibleSplice`.
 * Returns [start, end, replacement text].
 */
export const laterSplice = async (loader: string): Promise<[number, number, string]> => {
  const hit = AHEAD.exec(loader),
    start = START.exec(loader);
  if (!hit || !start) throw Error("build-loader: no fetch-ahead link loop in the minified loader");
  const fn = (await transform("(" + derivedFetchLater + ")(__s,__o,__p);", { minify: true, target: "es2020" })).code.trim().replace(/;$/, "");
  return [hit.index, hit.index + hit[0].length, fn.replace("(__s,__o,__p)", "(" + start[1] + "," + hit[1] + "," + hit[4] + ")")];
};
/** The lazy-part loader (`DERIVED_LOADER_LATER`); `visible` = with the visible boot too (`DERIVED_LOADER_VISIBLE_LATER`). */
export const minifiedDerivedLater = async (visible?: boolean): Promise<string> => {
  const loader = await minifiedDerived(),
    [from, to, text] = await laterSplice(loader),
    later = loader.slice(0, from) + text + loader.slice(to);
  if (!visible) return later;
  const [at, boot] = await visibleSplice(later);
  return later.slice(0, at) + boot + later.slice(at);
};
/** The loader's minified start, its `rt?.on(event)` ask and its held item (after a press's / held event's `preventDefault`). */
const HEAD = /^\(function\(\)\{/,
  ASK = /\|\|(\w+)\?\.on\((\w+)\)\)return;/,
  HOLD = /(\w+)&&(\w+)\.preventDefault\(\);const (\w+)=\[\2,\2\.composedPath\(\)/;
/**
 * COLD-DND: the drag loaders (pages whose `data-events` lists a drag type) = a loader with `derivedDrag` spliced in: its
 * instance `$d` made first thing, `!$d(<event>)&&` before the `rt?.on(<event>)` ask and `$d(<event>,1);` before the held
 * item is made. The same three text replacements apply to every loader variant (the visible / lazy-part splices touch
 * other places): [search, replacement] pairs.
 */
export const dragSplice = async (loader: string): Promise<[string, string][]> => {
  const head = HEAD.exec(loader),
    ask = ASK.exec(loader),
    hold = HOLD.exec(loader);
  if (!head || !ask || !hold) throw Error("build-loader: no drag splice point in the minified loader");
  if (loader.includes("$d")) throw Error("build-loader: the minified loader already uses $d");
  // (Assigned: an unused call of a pure function minifies away.)
  const fn = (await transform("__d=(" + derivedDrag + ")();", { minify: true, target: "es2020" })).code.trim().replace(/^__d=/, "").replace(/;$/, "");
  const [, rt, event] = ask,
    held = hold[0].slice(0, hold[0].indexOf(";") + 1);
  return [
    [head[0], head[0] + "const $d=" + fn + ";"],
    [ask[0], "||!$d(" + event + ")&&" + rt + "?.on(" + event + "))return;"],
    [held, held + "$d(" + hold[2] + ",1);"],
  ];
};
const spliced = (loader: string, pairs: [string, string][]): string => pairs.reduce((l, [from, to]) => l.replace(from, () => to), loader);
/** A drag loader (`DERIVED_LOADER_DRAG` …): `loader` = one of the minified variants. */
export const minifiedDerivedDrag = async (loader: string): Promise<string> => spliced(loader, await dragSplice(await minifiedDerived()));
/**
 * HTMLBYTES: loader parts a page provably never runs, by bit (`server-derived.ts` `loaderCuts`): per bit, [regex, replacement]
 * pairs; each regex finds one minified text, replaced by the replacement (default: deleted). 0 the cold-key hold (`data-rk` /
 * tail `k`: no record listens to `keydown`), 1 the cold pointer capture (`data-rv-capture`: no record listens to
 * `pointerdown`), 2 the `invalid` / `contextmenu` hold (neither in `data-events`), 3 the `data-g` document clicks (no
 * `data-g`), 4 the `intent` hover hold + pruning (`data-fw` is not `intent`: the flag is gone), 5 the `data-boot` start +
 * prime check (no `data-boot`; never on a visible-boot loader, whose `data-boot` start is spliced — keep it last).
 */
const CUTS: [RegExp, string?][][] = [
  [[/const \w+=\w+\.key;[^}]*?\.preventDefault\(\)(?=\})/]],
  [[/if\(\w+=="pointerdown"&&\w+\.button==0\)try\{[^}]*\}catch\{\}/]],
  [[/else if\(\w+=="invalid"\|\|\w+=="contextmenu"&&\w+\.closest\?\.\("\[data-cm\]"\)\)\w+=\(\)=>\{\};/]],
  [[/\w+\.length\|\|!\w+\.closest\?\.\(\w+\.dataset\.g\)\|\|\w+\.push\(""\),/], [/\|\|\w+\.closest\?\.\(\w+\.dataset\.g\)/]],
  [
    [/,([\w$]+)=[\w$]+=="intent"(?=,)/],
    [/,[\w$]+=\/\^\(pointer\|mouse\)\(over\|enter\)\$\/(?=,)/],
    [
      /if\([\w$]+\)for\(let [\w$]+=[\w$]+\.length;[\w$]+--;\)[\w$]+\.test\([\w$]+\[[\w$]+\]\[0\]\.type\)&&![\w$]+\([\w$]+\[[\w$]+\]\[0\]\.target\)&&[\w$]+\.splice\([\w$]+,1\)/,
    ],
    [/\([\w$]+\|\|!\([\w$]+&&[\w$]+\.test\([\w$]+\)\)\)&&/],
    [/;[\w$]+\|\|(?=[\w$]+\?\.saveData)/, ";"],
  ],
  [[/,\w+\.hasAttribute\("data-boot"\)&&\w+\(1\)\.catch\(\w+\)(?=;)/], [/\w+\.hasAttribute\("data-boot"\)\|\|/]],
];
/** The cut [text, replacement] pairs of the minified loader, by bit. */
export const loaderCuts = (loader: string): [string, string][][] => {
  const cuts = CUTS.map((group, bit) =>
    group.map(([re, to = ""]): [string, string] => {
      const hit = loader.match(re)?.[0];
      if (!hit || loader.indexOf(hit) !== loader.lastIndexOf(hit)) throw Error("build-loader: cut " + bit + " not found once in the minified loader");
      return [hit, to];
    }),
  );
  // The intent cut drops the flag's and the hover regex's declarations: no other reference to their names may remain.
  if (intentRead(applyCuts(loader, cuts, 1 << 4), cuts)) throw Error("build-loader: an intent declaration is still read after its cut");
  return cuts;
};
/** Whether a loader still names a declaration the intent cut drops (as an identifier). */
const intentRead = (loader: string, cuts: [string, string][][]): boolean =>
  cuts[4]!.slice(0, 2).some(([text]) => new RegExp("(?<![\\w$.])" + /,([\w$]+)=/.exec(text)![1]!.replace(/\$/g, "\\$") + "(?![\\w$])").test(loader));
/** A loader variant with the parts of `cut`'s bits replaced (as `server-derived.ts` does). */
export const applyCuts = (loader: string, cuts: readonly (readonly (readonly [string, string])[])[], cut: number): string =>
  cuts.reduce((l, pairs, bit) => (cut & (1 << bit) ? pairs.reduce((x, [from, to]) => x.replace(from, () => to), l) : l), loader);
/** Minified stream add-on (`$rD`), shipped once before a page's first streamed segment. */
export const minifiedDerivedStream = (): Promise<string> => minify(derivedStream);

if (import.meta.url === new URL(process.argv[1]!, "file://").href) {
  const derived = await minifiedDerived(),
    [at, splice] = await visibleSplice(derived),
    [from, to, laterText] = await laterSplice(derived),
    derivedAdd = await minifiedDerivedStream(),
    drags = await dragSplice(derived),
    cuts = loaderCuts(derived);
  if (to > at) throw Error("build-loader: the fetch-ahead loop follows the data-boot start");
  // In the lazy-part loader the data-boot start moved by the length difference of the replaced loop.
  const atLater = at + laterText.length - (to - from);
  // Every cut applies to every variant (the splices touch other places) and leaves a parseable loader, in any combination.
  {
    const later = derived.slice(0, from) + laterText + derived.slice(to),
      plain = [derived, later],
      visible = [derived.slice(0, at) + splice + derived.slice(at), later.slice(0, atLater) + splice + later.slice(atLater)];
    for (const [list, mask] of [
      [plain, CUTS.length],
      [visible, CUTS.length - 1],
    ] as const)
      for (const v of list.flatMap((l) => [l, spliced(l, drags)])) {
        for (const [text] of cuts.slice(0, mask).flat())
          if (v.indexOf(text) < 0 || v.indexOf(text) !== v.lastIndexOf(text)) throw Error("build-loader: cut text not once in a variant");
        for (let cut = 0; cut < 1 << mask; cut++) new Function(applyCuts(v, cuts, cut));
        if (intentRead(applyCuts(v, cuts, 1 << 4), cuts)) throw Error("build-loader: an intent declaration is still read after its cut");
      }
  }
  await writeFile(
    new URL("./resume-loader-derived.min.ts", import.meta.url),
    "// Generated by build-loader.ts from resume-loader-derived.ts. Do not edit.\n" +
      "export const DERIVED_LOADER = " +
      JSON.stringify(derived) +
      ";\n" +
      '/** The loader of a page whose only triggers are `visible` ones (`data-boot="<ids>"`, `derivedVisibleBoot`). */\n' +
      `export const DERIVED_LOADER_VISIBLE = DERIVED_LOADER.slice(0, ${at}) + ${JSON.stringify(splice)} + DERIVED_LOADER.slice(${at});\n` +
      "/** The loader of a page with lazy parts (`data-fl`, `derivedFetchLater`); `_VISIBLE_LATER`: with the visible boot too. */\n" +
      `export const DERIVED_LOADER_LATER = DERIVED_LOADER.slice(0, ${from}) + ${JSON.stringify(laterText)} + DERIVED_LOADER.slice(${to});\n` +
      `export const DERIVED_LOADER_VISIBLE_LATER = DERIVED_LOADER_LATER.slice(0, ${atLater}) + ${JSON.stringify(splice)} + DERIVED_LOADER_LATER.slice(${atLater});\n` +
      "/** COLD-DND: each loader with the cold drag add-on (`derivedDrag`), for pages whose `data-events` lists a drag type. */\n" +
      "const drag = (loader: string): string => " +
      drags.map(([from, to]) => ".replace(" + JSON.stringify(from) + ", () => " + JSON.stringify(to) + ")").reduce((code, step) => code + step, "loader") +
      ";\n" +
      "export const DERIVED_LOADER_DRAG = drag(DERIVED_LOADER);\n" +
      "export const DERIVED_LOADER_VISIBLE_DRAG = drag(DERIVED_LOADER_VISIBLE);\n" +
      "export const DERIVED_LOADER_LATER_DRAG = drag(DERIVED_LOADER_LATER);\n" +
      "export const DERIVED_LOADER_VISIBLE_LATER_DRAG = drag(DERIVED_LOADER_VISIBLE_LATER);\n" +
      "/** HTMLBYTES: loader parts a page provably never runs, by bit (`server-derived.ts` `loaderCuts`): [text, replacement] pairs, any variant. */\n" +
      "export const DERIVED_LOADER_CUTS: readonly (readonly (readonly [string, string])[])[] = " +
      JSON.stringify(cuts) +
      ";\n" +
      "export const DERIVED_STREAM = " +
      JSON.stringify(derivedAdd) +
      ";\n",
  );
  const derivedVisible = derived.slice(0, at) + splice + derived.slice(at);
  console.log(
    "derived " +
      derived.length +
      " chars (visible boot " +
      derivedVisible.length +
      ", lazy parts +" +
      (laterText.length - (to - from)) +
      ", drag +" +
      (spliced(derived, drags).length - derived.length) +
      ", + stream " +
      derivedAdd.length +
      ")",
  );
}
