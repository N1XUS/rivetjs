// T3: value mapping (individual transform properties, units, keyframes), variants, CSS entrances + springs.
import { test } from "vitest";
import assert from "node:assert/strict";
import { spring } from "motion";
import { cssKeyframes, finalState, hybridReason, styleText, toStyle, transitionOf } from "../values.ts";
import { activeTarget, fallbackTarget, mergeTransition, resolveTarget } from "../variants.ts";
import { cssTiming, entranceRule } from "../css.ts";

test("toStyle: independent transforms → translate / scale / rotate, Motion's default units", () => {
  assert.deepEqual(toStyle(finalState({ x: 10, y: "2rem", scale: 1.1, rotate: 45, opacity: 0 })), {
    opacity: "0",
    translate: "10px 2rem",
    scale: "1.1",
    rotate: "45deg",
  });
  assert.deepEqual(toStyle(finalState({ scaleX: 2 })), { scale: "2 1" });
  assert.deepEqual(toStyle(finalState({ z: 5 })), { translate: "0px 0px 5px" });
  assert.deepEqual(toStyle(finalState({ backgroundColor: "red", width: 10, "--tint": 3, zIndex: 2 })), {
    "background-color": "red",
    width: "10px",
    "--tint": "3",
    "z-index": "2",
  });
  assert.equal(styleText({ opacity: "1", translate: "0px 0px" }), "opacity:1;translate:0px 0px");
});

test("finalState: x only keeps y from the previous state; keyframes end on their last value", () => {
  const prev = finalState({ x: 0, y: 8 });
  assert.deepEqual(toStyle(finalState({ x: 20 }, prev)), { translate: "20px 8px" });
  assert.deepEqual(finalState({ opacity: [0, 0.5, 1] }), { opacity: 1 });
});

test("cssKeyframes: single values start from the current state; groups compose per frame", () => {
  assert.deepEqual(cssKeyframes({ opacity: 1, y: 0 }, { opacity: 0, x: 4, y: 8 }), { opacity: ["0", "1"], translate: ["4px 8px", "4px 0px"] });
  assert.deepEqual(cssKeyframes({ x: [0, 10, 0] }, {}), { translate: ["0px 0px", "10px 0px", "0px 0px"] });
  assert.deepEqual(cssKeyframes({ scale: [null, 1.2] }, { scale: 0.5 }), { scale: ["0.5", "1.2"] });
});

test("hybridReason: hybrid-only values and split transitions on one CSS property name the fix", () => {
  assert.match(hybridReason({ pathLength: 1 })!, /@rivetjs\/motion\/animate/);
  assert.match(hybridReason({ rotateX: 30 })!, /hybrid/);
  assert.match(hybridReason({ x: 1, y: 1 }, { x: { duration: 1 }, y: { duration: 2 } })!, /translate/);
  assert.equal(hybridReason({ x: 1, y: 1 }, { x: { duration: 1 }, y: { duration: 1 } }), undefined);
  assert.equal(hybridReason({ x: 1, opacity: [0, 1] }), undefined);
});

test("transitionOf: value override for its CSS property over the shared options", () => {
  const t = { duration: 1, opacity: { duration: 0.2 } };
  assert.deepEqual(transitionOf(t, { opacity: 1, x: 1 }, "opacity"), { duration: 0.2 });
  assert.deepEqual(transitionOf(t, { opacity: 1, x: 1 }, "translate"), { duration: 1 });
});

test("variants: labels, arrays, functions of custom; layer priority; fallback on gesture end", () => {
  const variants = { hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: 0.2 } }, big: (c: unknown) => ({ scale: c as number }) };
  assert.deepEqual(resolveTarget("hidden", variants, 0), { opacity: 0 });
  assert.deepEqual(resolveTarget(["hidden", "big"], variants, 2), { opacity: 0, scale: 2 });
  assert.deepEqual(
    resolveTarget((c) => ({ x: c as number }), variants, 3),
    { x: 3 },
  );
  assert.equal(resolveTarget(false, variants, 0), undefined);
  assert.deepEqual(activeTarget({ animate: { scale: 1, opacity: 1 }, whileHover: { scale: 1.1 }, whilePress: { scale: 0.9 } }), { scale: 0.9, opacity: 1 });
  assert.deepEqual(activeTarget({ animate: { scale: 1 }, whileHover: { scale: 1.1 }, exit: { opacity: 0 } }), { scale: 1.1, opacity: 0 });
  assert.deepEqual(fallbackTarget({ animate: { scale: 1 }, whileHover: { scale: 1.1, rotate: 5 } }, "whileHover", { rotate: 0 }), { scale: 1, rotate: 0 });
  assert.deepEqual(mergeTransition({ duration: 1 }, { ease: "linear" }, { duration: 0.2 }), { duration: 0.2, ease: "linear" });
});

test("cssTiming: tween defaults (0.3 s, ease-out; 0.8 s for keyframes), repeat, Motion's spring value; the string spring is an error", () => {
  assert.deepEqual(cssTiming({}, 2), { duration: 300, delay: 0, easing: "ease-out", iterations: 1, direction: "normal" });
  assert.equal(cssTiming({}, 3).duration, 800);
  assert.deepEqual(cssTiming({ duration: 1, ease: [0.1, 0.2, 0.3, 0.4], repeat: 2, repeatType: "reverse", delay: 0.1 }, 2), {
    duration: 1000,
    delay: 100,
    easing: "cubic-bezier(0.1, 0.2, 0.3, 0.4)",
    iterations: 3,
    direction: "alternate",
  });
  const byValue = cssTiming({ type: spring as never, visualDuration: 0.3, bounce: 0.2 }, 2);
  const motion = (spring as unknown as { applyToOptions(o: object): { duration: number } }).applyToOptions({ visualDuration: 0.3, bounce: 0.2 });
  assert.equal(byValue.duration, motion.duration);
  assert.match(byValue.easing, /^linear\(0, /);
  assert.throws(() => cssTiming({ type: "spring" as never, visualDuration: 0.3 }, 2), /import \{ spring \} from "@rivetjs\/motion"/);
});

test("entranceRule: keyframes + animation both, deduped by content hash, reduced motion in the same CSS", () => {
  const rule = entranceRule({ opacity: 0, y: 8 }, { opacity: 1, y: 0 }, undefined)!;
  assert.equal(entranceRule({ opacity: 0, y: 8 }, { opacity: 1, y: 0 }, undefined)!.hash, rule.hash);
  assert.equal(
    rule.css,
    `@keyframes rv-mve-${rule.hash}-1{0%{opacity:0;translate:0px 8px}100%{opacity:1;translate:0px 0px}}` +
      `[data-mve="${rule.hash}"]{animation:rv-mve-${rule.hash}-1 300ms ease-out 0ms 1 normal backwards}` +
      `@media (prefers-reduced-motion:reduce){@keyframes rv-mve-${rule.hash}-1r{0%{opacity:0}100%{opacity:1}}[data-mve="${rule.hash}"]{animation:rv-mve-${rule.hash}-1r 300ms ease-out 0ms 1 normal backwards}}`,
  );
  // "always" = reduced motion regardless of the preference: transforms jump, opacity still fades; no media block.
  assert.equal(entranceRule({ y: 8 }, { y: 0 }, undefined, "always"), undefined);
  const always = entranceRule({ opacity: 0, y: 8 }, { opacity: 1, y: 0 }, undefined, "always")!.css;
  assert.doesNotMatch(always, /translate|@media/);
  assert.match(always, /opacity:0/);
  assert.match(entranceRule({ y: 8 }, { y: 0 }, undefined, "user")!.css, /\{animation:none\}\}$/);
  assert.doesNotMatch(entranceRule({ y: 8 }, { y: 0 }, undefined, "never")!.css, /@media/);
  assert.equal(entranceRule({ opacity: 1 }, { opacity: 1 }, undefined), undefined);
});

test("entranceRule: per-value transitions split into one animation per timing; keyframes use times and per-step easings", () => {
  const split = entranceRule({ opacity: 0, x: -10 }, { opacity: 1, x: 0 }, { duration: 0.5, opacity: { duration: 0.1 } }, "never")!;
  assert.match(split.css, /animation:rv-mve-\w+-1 100ms ease-out 0ms 1 normal backwards,rv-mve-\w+-2 500ms ease-out 0ms 1 normal backwards/);
  const steps = entranceRule({}, { scale: [1, 1.2, 1] }, { times: [0, 0.3, 1], ease: ["easeIn", "easeOut"] }, "never")!;
  assert.match(steps.css, /0%\{scale:1;animation-timing-function:ease-in\}30%\{scale:1.2;animation-timing-function:ease-out\}100%\{scale:1\}/);
  assert.match(steps.css, / 800ms linear 0ms /);
});
