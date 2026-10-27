// MOTION-CSS: the source half of CSS-only Motion call sites (`static-motion.ts`) with the package's own lowering
// (`@rivetjs/motion/static`). The call-site proof and the Vite wiring: `vite-motion.test.ts`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { staticMotion } from "@rivetjs/motion/static";
import { applyMotion, motionContextToken, motionSites, type MotionLowering } from "../static-motion.ts";

const lower = staticMotion as MotionLowering;
const FILE = "/app/src/routes/index.tsx";
const css = (hash: string) => "rivet-motion-entrance:" + hash + ".css";
const rewrite = (source: string) => applyMotion(source, motionSites(source, FILE, lower), css);

test("a constant entrance becomes the plain element with its final state and the rule's hash, plus the rule's import", () => {
  const source = `import { Motion } from "@rivetjs/motion";
export default function Home() {
  return <Motion.h1 class="t" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>Hi {name()}</Motion.h1>;
}`;
  const [site] = motionSites(source, FILE, lower);
  assert.equal(site!.component, "Home");
  assert.equal(site!.tag, "Motion.h1");
  assert.equal(site!.ordinal, 0);
  const lowered = staticMotion({ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } });
  assert.ok(typeof lowered !== "string" && lowered.mve && lowered.css?.includes(`[data-mve="${lowered.mve}"]`));
  assert.equal(
    rewrite(source),
    `import { Motion } from "@rivetjs/motion";
export default function Home() {
  return <h1 class="t" style={{"opacity":"1","translate":"0px 0px"}} data-mve="${lowered.mve}">Hi {name()}</h1>;
}
import "rivet-motion-entrance:${lowered.mve}.css";`,
  );
});

test("animate only renders the final state (no rule); self-closing and multi-line tags keep their line count", () => {
  const source = `import { Motion as M } from "@rivetjs/motion";
const Bar = () => (
  <M.div
    animate={{ opacity: 0.5, scale: 2 }}
  />
);`;
  assert.equal(
    rewrite(source),
    `import { Motion as M } from "@rivetjs/motion";
const Bar = () => (
  <div style={{"opacity":"0.5","scale":"2"}}

 />
);`,
  );
});

test("dynamic values, Motion behaviour props, spreads and labels keep the component", () => {
  const keep = [
    `<Motion.p initial={{ opacity: 0 }} animate={{ opacity: open() ? 1 : 0 }} />`,
    `<Motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: spring }} />`,
    `<Motion.p animate={{ opacity: 1 }} whileHover={{ scale: 1.1 }} />`,
    `<Motion.p animate={{ opacity: 1 }} whileInView={{ opacity: 1 }} />`,
    `<Motion.p animate={{ opacity: 1 }} exit={{ opacity: 0 }} />`,
    `<Motion.p animate={{ opacity: 1 }} layout />`,
    `<Motion.p animate={{ opacity: 1 }} style={{ color: "red" }} />`,
    `<Motion.p animate={{ opacity: 1 }} ref={el} />`,
    `<Motion.p animate={{ opacity: 1 }} {...rest} />`,
    `<Motion.p variants={v} initial="hidden" animate="show" />`,
    `<Motion.p initial="hidden" animate="show" />`,
    `<Motion.p animate={{ rotateX: 40 }} />`,
    `<Motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ease: "bounceOut" }} />`,
    `<Motion.p animate={{ opacity: 1 }} onPointerEnter={f} />`,
  ];
  for (const jsx of keep) {
    const source = `import { Motion } from "@rivetjs/motion";\nexport function C() {\n  return ${jsx};\n}`;
    const [site] = motionSites(source, FILE, lower);
    assert.equal(site!.rewrite, null, jsx);
    assert.equal(rewrite(source), source, jsx);
  }
});

test("other attributes (handlers, expressions) and the children stay as written; nested elements rewrite independently", () => {
  const source = `import { Motion } from "@rivetjs/motion";
export function List(props) {
  return (
    <Show when={props.on}>
      <Motion.ul id={props.id} onClick={() => props.pick()} animate={{ opacity: 1 }}>
        <Motion.li initial={{ x: -8 }} animate={{ x: 0 }} transition={{ repeat: Infinity, repeatType: "reverse", duration: 1 }}>{props.label}</Motion.li>
      </Motion.ul>
    </Show>
  );
}`;
  const sites = motionSites(source, FILE, lower);
  assert.deepEqual(
    sites.map((s) => [s.component, s.tag, s.ordinal, s.around]),
    [
      ["List", "Motion.ul", 0, ["Show"]],
      ["List", "Motion.li", 0, ["Motion.ul", "Show"]],
    ],
  );
  const out = rewrite(source);
  assert.match(out, /<ul id=\{props\.id\} onClick=\{\(\) => props\.pick\(\)\} style=\{\{"opacity":"1"\}\}>/);
  assert.match(out, /<li style=\{\{"translate":"0px 0px"\}\} data-mve="\w+">\{props\.label\}<\/li>\n {6}<\/ul>/);
  assert.equal((out.match(/^import "rivet-motion-entrance:/gm) ?? []).length, 1);
});

test("no Motion import, a shadowed name, JSX outside a top-level component: nothing", () => {
  assert.deepEqual(motionSites(`const Motion = { h1: "h1" };\nexport const A = () => <Motion.h1 animate={{ opacity: 1 }} />;`, FILE, lower), []);
  const shadow = `import { Motion } from "@rivetjs/motion";\nexport function A({ Motion }) {\n  return <Motion.h1 animate={{ opacity: 1 }} />;\n}`;
  assert.deepEqual(motionSites(shadow, FILE, lower), []);
  const helper = `import { Motion } from "@rivetjs/motion";\nexport const rows = [1].map(() => <Motion.li animate={{ opacity: 1 }} />);`;
  assert.deepEqual(
    motionSites(helper, FILE, lower).map((s) => [s.component, s.rewrite]),
    [[null, null]],
  );
});

test("only elements rendered where they are written: JSX kept in a variable or handed to a helper keeps the component", () => {
  const source = `import { Motion } from "@rivetjs/motion";
export function Page(props) {
  const title = <Motion.h1 animate={{ opacity: 1 }} />;
  const row = () => <Motion.p animate={{ opacity: 1 }} />;
  return (
    <main>
      <MotionConfig reducedMotion="always">{title}{row()}{wrap(<Motion.b animate={{ opacity: 1 }} />)}</MotionConfig>
      {props.on ? <Motion.i animate={{ opacity: 1 }} /> : null}
      {props.items.map((item) => <Motion.li animate={{ opacity: 1 }}>{item}</Motion.li>)}
      <For each={props.items}>{(item) => <Motion.dd animate={{ opacity: 1 }} />}</For>
      <Card footer={<Motion.span animate={{ opacity: 1 }} />} />
      <div title={<Motion.em animate={{ opacity: 1 }} />} />
    </main>
  );
}`;
  assert.deepEqual(
    motionSites(source, FILE, lower).map((s) => [s.tag, s.rewrite !== null]),
    [
      ["Motion.h1", false],
      ["Motion.p", false],
      ["Motion.b", false],
      ["Motion.i", true],
      ["Motion.li", true],
      ["Motion.dd", true],
      ["Motion.span", true],
      ["Motion.em", false],
    ],
  );
});

test("context tokens that keep the component", () => {
  assert.equal(motionContextToken("/r/libs/motion/element.tsx#ConfigContext"), true);
  assert.equal(motionContextToken("/r/node_modules/@rivetjs/motion/element.jsx#VariantContext"), true);
  assert.equal(motionContextToken("/r/libs/kit/transition.tsx#Scope"), true);
  assert.equal(motionContextToken("pkg:@rivetjs/ui"), true);
  assert.equal(motionContextToken("mod:virtual:x"), true);
  assert.equal(motionContextToken("pkg:@rivetjs/router"), false);
  assert.equal(motionContextToken("/r/libs/router/client/route-context.ts#ServerData"), false);
  assert.equal(motionContextToken("!suspense"), false);
});
