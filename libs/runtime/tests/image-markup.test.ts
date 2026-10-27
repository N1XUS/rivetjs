import { test } from "vitest";
import assert from "node:assert/strict";
import { pictureHtml, resolveSizes, preloadLink, preloadHtml, srcset, imageSet } from "../image-markup.ts";
import type { ImageDescriptor } from "../image-plan.ts";

const hero: ImageDescriptor = {
  src: "/h-800.jpg",
  width: 800,
  height: 400,
  layout: "constrained",
  sizes: "(min-width: 800px) 800px, 100vw",
  placeholder: { kind: "color", value: "#112233" },
  sources: [
    { type: "image/avif", srcset: "/h-640.avif 640w, /h-800.avif 800w, /h-1600.avif 1600w" },
    { type: "image/jpeg", srcset: "/h-640.jpg 640w, /h-800.jpg 800w, /h-1600.jpg 1600w" },
  ],
};
const mobile: ImageDescriptor = {
  src: "/m-400.jpg", width: 400, height: 400, layout: "constrained",
  sources: [
    { type: "image/webp", srcset: "/m-400.webp 400w" },
    { type: "image/jpeg", srcset: "/m-400.jpg 400w" },
  ],
};
const icon: ImageDescriptor = {
  src: "/i-24.png", width: 24, height: 24, layout: "fixed",
  sources: [{ type: "image/png", srcset: "/i-24.png 1x, /i-48.png 2x" }],
};

test("multi-format → picture with non-fallback sources, img carries fallback", () => {
  assert.equal(
    pictureHtml({ image: hero, alt: "Hero" }),
    '<picture><source type="image/avif" srcset="/h-640.avif 640w, /h-800.avif 800w, /h-1600.avif 1600w" sizes="(min-width: 800px) 800px, 100vw">' +
      '<img src="/h-800.jpg" srcset="/h-640.jpg 640w, /h-800.jpg 800w, /h-1600.jpg 1600w" sizes="(min-width: 800px) 800px, 100vw" width="800" height="400" alt="Hero" loading="lazy" decoding="async" style="background-color:#112233"></picture>',
  );
});

test("single type collapses to bare img; x descriptors omit sizes", () => {
  assert.equal(
    pictureHtml({ image: icon, alt: "" }),
    '<img src="/i-24.png" srcset="/i-24.png 1x, /i-48.png 2x" width="24" height="24" alt="" loading="lazy" decoding="async">',
  );
});

test("as forces wrapper either way", () => {
  assert.match(pictureHtml({ image: icon, alt: "", as: "picture", pictureClass: "p" }), /^<picture class="p"><img /);
  assert.match(pictureHtml({ image: hero, alt: "x", as: "img" }), /^<img src="\/h-800.jpg"/);
});

test("art direction: media sources carry all types + own dims, default last", () => {
  const html = pictureHtml({ alt: "a", image: { "(max-width: 640px)": mobile, default: hero } });
  assert.equal(
    html.slice(0, html.indexOf("<img")),
    '<picture><source media="(max-width: 640px)" type="image/webp" srcset="/m-400.webp 400w" width="400" height="400">' +
      '<source media="(max-width: 640px)" type="image/jpeg" srcset="/m-400.jpg 400w" width="400" height="400">' +
      '<source type="image/avif" srcset="/h-640.avif 640w, /h-800.avif 800w, /h-1600.avif 1600w" sizes="(min-width: 800px) 800px, 100vw">',
  );
  assert.throws(() => pictureHtml({ alt: "a", as: "img", image: { "(max-width: 640px)": mobile, default: hero } }), /Art direction requires <picture>/);
});

test("priority → eager + fetchpriority high; sizes auto forces lazy and rejects priority", () => {
  assert.match(pictureHtml({ image: icon, alt: "", priority: true }), /loading="eager" decoding="async" fetchpriority="high"/);
  assert.match(pictureHtml({ image: hero, alt: "", sizes: "auto" }).replace(/^.*<img/, "<img"), /sizes="auto, \(min-width: 800px\) 800px, 100vw"/);
  assert.throws(() => pictureHtml({ image: hero, alt: "", sizes: "auto", priority: true }), /sizes="auto" requires lazy loading/);
});

test("attribute escaping, user style merges after placeholder, alt required", () => {
  const html = pictureHtml({ image: icon, alt: 'a"<b', class: "c&d", style: "border:0", id: "i", title: "t" });
  assert.match(html, /alt="a&quot;&lt;b"/);
  assert.match(html, /class="c&amp;d" id="i" title="t"/);
  assert.match(pictureHtml({ image: hero, alt: "", style: "border:0" }), /style="background-color:#112233;border:0"/);
  assert.throws(() => pictureHtml({ image: icon } as never), /requires alt/);
});

test("placeholder validation blocks CSS injection; blur emits background image", () => {
  assert.throws(() => pictureHtml({ image: { ...icon, placeholder: { kind: "color", value: "red;x:url(evil)" } }, alt: "" }), /Invalid image placeholder/);
  assert.throws(() => pictureHtml({ image: { ...icon, placeholder: { kind: "blur", src: "data:text/html,<x>" } }, alt: "" }), /Invalid image placeholder/);
  assert.match(
    pictureHtml({ image: { ...icon, placeholder: { kind: "blur", src: "data:image/webp;base64,AAAA" } }, alt: "" }),
    /style="background-image:url\(data:image\/webp;base64,AAAA\);background-size:cover;background-position:center;background-repeat:no-repeat"/,
  );
});

test("unsafe src/srcset neutralized by the attribute encoder; data: images allowed", () => {
  assert.match(pictureHtml({ image: { ...icon, src: "javascript:alert(1)" }, alt: "" }), /<img src="about:invalid#rivet"/);
  const png = "data:image/png;base64,AAAA";
  assert.match(pictureHtml({ image: { ...icon, src: png, sources: [{ type: "image/png", srcset: png + " 1x" }] }, alt: "" }), /<img src="data:image\/png;base64,AAAA" srcset="data:image\/png;base64,AAAA 1x"/);
  assert.match(pictureHtml({ image: { ...icon, src: "data:image/svg+xml,x" }, alt: "" }), /<img src="about:invalid#rivet"/);
});

test("resolveSizes: names, numbers, raw media, default, auto", () => {
  assert.equal(resolveSizes(undefined, "100vw"), "100vw");
  assert.equal(resolveSizes("50vw", "100vw"), "50vw");
  assert.equal(resolveSizes("auto", undefined), "auto, 100vw");
  assert.equal(
    resolveSizes({ md: "50vw", "(orientation: portrait)": "90vw", lg: "33vw", 1800: "600px", default: "100vw" }, undefined),
    "(orientation: portrait) 90vw, (min-width: 1800px) 600px, (min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw",
  );
  assert.equal(resolveSizes({ md: "50vw" }, "(min-width: 800px) 800px, 100vw"), "(min-width: 768px) 50vw, (min-width: 800px) 800px, 100vw");
  assert.throws(() => resolveSizes({ huge: "1px" }, undefined), /Unknown sizes key "huge"/);
});

test("preload link + html", () => {
  const link = preloadLink(hero);
  assert.deepEqual(link, {
    rel: "preload", as: "image", href: "/h-800.jpg",
    imagesrcset: "/h-640.avif 640w, /h-800.avif 800w, /h-1600.avif 1600w",
    imagesizes: "(min-width: 800px) 800px, 100vw", type: "image/avif", fetchpriority: "high",
  });
  assert.equal(
    preloadHtml(preloadLink(icon, { media: "(min-width: 1px)" })),
    '<link rel="preload" as="image" href="/i-24.png" imagesrcset="/i-24.png 1x, /i-48.png 2x" type="image/png" fetchpriority="high" media="(min-width: 1px)">',
  );
});

test("srcset helper and CSS image-set", () => {
  assert.equal(srcset(hero), hero.sources[0]!.srcset);
  assert.equal(srcset(hero, "image/jpeg"), hero.sources[1]!.srcset);
  assert.throws(() => srcset(hero, "image/gif"), /No image\/gif source/);
  assert.equal(
    imageSet(hero),
    'image-set(url("/h-800.avif") type("image/avif") 1x, url("/h-1600.avif") type("image/avif") 2x, url("/h-800.jpg") type("image/jpeg") 1x, url("/h-1600.jpg") type("image/jpeg") 2x)',
  );
  assert.equal(imageSet(icon), 'image-set(url("/i-24.png") type("image/png") 1x, url("/i-48.png") type("image/png") 2x)');
});

test("pictureHtml renders from the descriptor's current values on every call (no per-descriptor markup cache)", () => {
  // Descriptors may be getter-backed (signals): a markup cache keyed on the object would serve stale src.
  let variant = "a";
  const image = { ...hero, get src() { return "/" + variant + ".jpg"; } } as ImageDescriptor;
  assert.match(pictureHtml({ image, alt: "" }), /src="\/a\.jpg"/);
  variant = "b";
  assert.match(pictureHtml({ image, alt: "" }), /src="\/b\.jpg"/);
});

test("pictureHtml caches the descriptor markup of branded (build-emitted, deep-frozen) descriptors only", () => {
  const freeze = <T extends object>(value: T): T => {
    for (const item of Object.values(value)) if (item && typeof item === "object") freeze(item);
    return Object.freeze(value);
  };
  const branded = freeze({ ...structuredClone(hero), [Symbol.for("rivet.image")]: true }) as ImageDescriptor;
  const plain = pictureHtml({ image: hero, alt: "a", class: "c" });
  // Same markup as an unbranded copy, on the first and the cached call; per-call props still apply.
  assert.equal(pictureHtml({ image: branded, alt: "a", class: "c" }), plain);
  assert.equal(pictureHtml({ image: branded, alt: "a", class: "c" }), plain);
  assert.match(pictureHtml({ image: branded, alt: "b", pictureClass: "p", style: "color:red" }), /^<picture class="p"><source .*alt="b".*style="background-color:#112233;color:red">/);
  // The cache is keyed per `sizes` string too.
  assert.equal(pictureHtml({ image: branded, alt: "", sizes: "50vw" }), pictureHtml({ image: hero, alt: "", sizes: "50vw" }));
  assert.equal(pictureHtml({ image: branded, alt: "" }), pictureHtml({ image: hero, alt: "" }));
  // Object sizes and art direction are never cached (fresh every call).
  assert.equal(pictureHtml({ image: branded, alt: "", sizes: { md: "50vw" } }), pictureHtml({ image: hero, alt: "", sizes: { md: "50vw" } }));
});

test("server Picture: a translated alt / title (server t() value) renders the page locale's text, escaped", async () => {
  const { Picture } = await import("../image.ts");
  const { renderToString, _variantValue } = await import("../server.ts");
  const alt = _variantValue(["A <dog>", () => 'Ein "Hund"']);
  const title = _variantValue(["Photo", "Foto"]);
  const plain = pictureHtml({ image: hero, alt: "X", title: "Y" });
  const de = await renderToString(Picture({ image: hero, alt: alt as unknown as string, title: title as unknown as string }), { variant: 1 });
  assert.equal(de, plain.replace('alt="X"', 'alt="Ein &quot;Hund&quot;"').replace('title="Y"', 'title="Foto"'));
  const en = await renderToString(Picture({ image: hero, alt: alt as unknown as string }), { variant: 0 });
  assert.equal(en, pictureHtml({ image: hero, alt: "A <dog>" }));
  // Plain strings: one static fragment, as before.
  assert.equal(await renderToString(Picture({ image: hero, alt: "X", title: "Y" })), plain);
});
