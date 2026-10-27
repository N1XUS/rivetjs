// MOTION-CSS: `staticMotion` (the build-time form the compiler writes for a CSS-only call site, `@rivetjs/motion/static`)
// equals what the server element renders with no MotionConfig / variant parent / presence scope: the same inline final
// state, the same `data-mve` hash and the same head rule.
import { test } from "vitest";
import assert from "node:assert/strict";
import { Provider, renderToString } from "@rivetjs/runtime/server";
import { ServerData } from "@rivetjs/router/route-context";
import type { Head, HeadSink } from "@rivetjs/router";
import { Motion } from "../index.tsx";
import { staticMotion, type StaticMotionProps } from "../static.ts";
import { styleText } from "../values.ts";

const call = (component: unknown, props: object) => (component as (p: object) => unknown)(props);
async function server(props: StaticMotionProps): Promise<{ html: string; css: string[] }> {
  const entries: Head[] = [];
  const headSink: HeadSink = { nonce: "n0", push: (_level, head) => void entries.push(head) };
  const html = String(
    await renderToString((() =>
      Provider({
        token: ServerData,
        value: { url: new URL("http://x.test/"), data: undefined, headSink } as never,
        children: (() => call(Motion.h1, { ...props, class: "t", children: "x" })) as never,
      })) as never),
  );
  return { html, css: entries.flatMap((entry) => (entry.styles ?? []).map((style) => (style as { css: string }).css)) };
}

const CASES: StaticMotionProps[] = [
  { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } },
  { initial: { scale: 0.5, rotate: -10 }, animate: { scale: 1, rotate: 0 }, transition: { ease: [0.2, 0, 0, 1], delay: 0.1 } },
  { initial: { opacity: 0 }, animate: { opacity: [0, 0.6, 1], x: [0, 20, 0] }, transition: { times: [0, 0.3, 1], duration: 1 } },
  { initial: { x: -8 }, animate: { x: 0 }, transition: { repeat: Infinity, repeatType: "reverse", duration: 1 } },
  { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0, transition: { duration: 0.2 } }, reducedMotion: "always" },
  { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { opacity: { duration: 0.1 } }, reducedMotion: "never" },
  { initial: { backgroundColor: "#000" }, animate: { backgroundColor: "#fff" }, transition: { ease: "easeInOut" } },
  { animate: { opacity: 0.5, x: 10 } },
  { initial: false, animate: { opacity: 1, scale: 2 } },
  { initial: { opacity: 1 }, animate: { opacity: 1 } },
];

test("the static form is what the element renders on the server (style, data-mve, the head rule)", async () => {
  for (const props of CASES) {
    const lowered = staticMotion(props);
    assert.ok(typeof lowered !== "string", JSON.stringify(props));
    const { html, css } = await server(props);
    const style = styleText(lowered.style);
    assert.equal(html, `<h1 class="t"${style ? ` style="${style}"` : ""}${lowered.mve ? ` data-mve="${lowered.mve}"` : ""}>x</h1>`, JSON.stringify(props));
    assert.deepEqual(css, lowered.css ? [lowered.css] : [], JSON.stringify(props));
  }
});

test("no static form: hybrid values, labels, strings the CSS path rejects", () => {
  assert.match(staticMotion({ animate: { rotateX: 40 } }) as string, /hybrid engine/);
  assert.match(staticMotion({ initial: "hidden", animate: "show" } as never) as string, /variant labels/);
  assert.match(staticMotion({ initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { type: "spring" as never } }) as string, /spring value/);
  assert.match(staticMotion({ initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { ease: "bounceOut" } }) as string, /no CSS form/);
  assert.match(staticMotion({ animate: { opacity: 1 }, reducedMotion: "sometimes" as never }) as string, /policy/);
});
