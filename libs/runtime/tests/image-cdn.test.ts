import { test } from "vitest";
import assert from "node:assert/strict";
import { cdn, urlTemplate, cloudinary, imgix, cloudflare } from "../image-cdn.ts";

test("urlTemplate substitutes and encodes; explicit formats produce typed sources", () => {
  const t = urlTemplate("https://img.test/{src}?w={width}&h={height}&fm={format}&q={quality}");
  const d = cdn("/cats/a b.jpg", { cdn: t, width: 400, height: 200, layout: "fixed", formats: ["avif", "jpeg"], quality: 60 });
  assert.deepEqual(d, {
    src: "https://img.test/cats/a b.jpg?w=400&h=200&fm=jpeg&q=60",
    width: 400,
    height: 200,
    layout: "fixed",
    sources: [
      { type: "image/avif", srcset: "https://img.test/cats/a b.jpg?w=400&h=200&fm=avif&q=60 1x, https://img.test/cats/a b.jpg?w=800&h=400&fm=avif&q=60 2x" },
      { type: "image/jpeg", srcset: "https://img.test/cats/a b.jpg?w=400&h=200&fm=jpeg&q=60 1x, https://img.test/cats/a b.jpg?w=800&h=400&fm=jpeg&q=60 2x" },
    ],
  });
});

test("autoFormat builder → single untyped source; constrained sizes", () => {
  const d = cdn("cat.jpg", { cdn: cloudinary({ cloud: "demo" }), width: 800, height: 600 });
  assert.equal(d.sources.length, 1);
  assert.equal(d.sources[0]!.type, undefined);
  assert.equal(d.sizes, "(min-width: 800px) 800px, 100vw");
  assert.match(d.sources[0]!.srcset, /^https:\/\/res\.cloudinary\.com\/demo\/image\/upload\/w_640,h_480,c_fill,f_auto,q_auto\/cat\.jpg 640w, /);
  assert.match(d.sources[0]!.srcset, /w_1600,h_1200,c_fill,f_auto,q_auto\/cat\.jpg 1600w$/);
});

test("maxWidth caps variants; missing dims throw", () => {
  const d = cdn("x.jpg", { cdn: cloudflare(), width: 800, height: 400, maxWidth: 1000 });
  assert.match(d.sources[0]!.srcset, /\/cdn-cgi\/image\/width=1000,height=500,fit=cover,format=auto\/x\.jpg 1000w$/);
  assert.throws(() => cdn("x.jpg", { cdn: cloudflare(), width: 800 } as never), /cdn\("x\.jpg"\) needs width and height/);
});

test("provider URL shapes", () => {
  assert.equal(
    cloudinary({ cloud: "c" }).url("/a.png", { width: 100, format: "jpeg", quality: 70, fit: "contain" }),
    "https://res.cloudinary.com/c/image/upload/w_100,f_jpg,q_70/a.png",
  );
  assert.equal(
    cloudinary({ cloud: "c" }).url("a.png", { width: 100, height: 50, fit: "contain" }),
    "https://res.cloudinary.com/c/image/upload/w_100,h_50,c_fit,f_auto,q_auto/a.png",
  );
  assert.equal(imgix({ domain: "x.imgix.net" }).url("/a.jpg", { width: 300, height: 200, fit: "cover" }), "https://x.imgix.net/a.jpg?w=300&h=200&fit=crop&auto=format");
  assert.equal(imgix({ domain: "x.imgix.net" }).url("a.jpg", { width: 300, format: "jpeg", quality: 50 }), "https://x.imgix.net/a.jpg?w=300&fm=jpg&q=50");
  assert.equal(cloudflare({ origin: "https://s.test" }).url("a.jpg", { width: 300, format: "webp", quality: 80 }), "https://s.test/cdn-cgi/image/width=300,fit=cover,format=webp,quality=80/a.jpg");
});
