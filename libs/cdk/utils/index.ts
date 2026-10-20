// react-aria utilities.
// Ported from react-spectrum packages/react-aria/src/utils (Apache-2.0, © Adobe): chain, mergeProps,
// mergeRefs, runAfterTransition, focusWithoutScrolling, getOffset, useLabels, useDescription,
// useFormReset, useUpdateEffect; react-stately utils/number (clamp, snapValueToStep, toFixedNumber).
//
// `chain` / `mergeProps` / `mergeRefs` live in `../interactions/merge-props.tsx` (a resume-compiled
// module, so chained handlers stay resumable), `focusWithoutScrolling` / `runAfterTransition` in `./transitions.ts`;
// both are re-exported here.
// Rivet mapping of the hooks (no hooks, no re-renders):
// - `useLayoutEffect` / `useEffect` → `clientEffect(fn, { when })` from `@rivetjs/runtime/dom` in a
//   component (never runs on the server, resumes at its trigger), or `effect` in browser-only code.
// - `useUpdateEffect(cb, deps)` → `updateEffect(deps, cb)` (skips the first run).
// - `useLabels` / `useDescription` / `useFormReset` → plain functions returning attributes, or
//   attaching listeners from a handler / client effect, returning their cleanup.
import { effect, untrack, type Disposer } from "@rivetjs/reactivity";
import { createId } from "@rivetjs/runtime/id";

export { chain, mergeProps, mergeRefs, type RefLike } from "../interactions/merge-props.tsx";
// Leaf module (DOCS-COLD 2026-10-20): `interactions/utils.ts` imports these from there, so focus / overlay helpers
// never reach this barrel's `merge-props` re-export (chunk owner walks follow every static import).
export { _resetTransitions, focusWithoutScrolling, runAfterTransition, trackTransitions } from "./transitions.ts";

/** Offset of an element edge in client coordinates: left/top, or right/bottom when `reverse`. */
export function getOffset(element: Element, reverse?: boolean, orientation: "horizontal" | "vertical" = "horizontal"): number {
  const rect = element.getBoundingClientRect();
  if (reverse) return orientation === "horizontal" ? rect.right : rect.bottom;
  return orientation === "horizontal" ? rect.left : rect.top;
}

/** Clamps `value` into [min, max]. */
export function clamp(value: number, min: number = -Infinity, max: number = Infinity): number {
  return Math.min(Math.max(value, min), max);
}

/** Rounds `value` to the decimal precision of `step` (exponent notation steps included). */
export function roundToStepPrecision(value: number, step: number): number {
  let roundedValue = value;
  let precision = 0;
  const stepString = step.toString();
  const eIndex = stepString.toLowerCase().indexOf("e-");
  if (eIndex > 0) precision = Math.abs(Math.floor(Math.log10(Math.abs(step)))) + eIndex;
  else {
    const pointIndex = stepString.indexOf(".");
    if (pointIndex >= 0) precision = stepString.length - pointIndex;
  }
  if (precision > 0) {
    const pow = Math.pow(10, precision);
    roundedValue = Math.round(roundedValue * pow) / pow;
  }
  return roundedValue;
}

/** Snaps `value` to the nearest multiple of `step` from `min` (react-stately `snapValueToStep`), then clamps. */
export function snapValueToStep(value: number, min: number | undefined, max: number | undefined, step: number): number {
  min = Number(min);
  max = Number(max);
  const remainder = (value - (isNaN(min) ? 0 : min)) % step;
  let snappedValue = roundToStepPrecision(
    Math.abs(remainder) * 2 >= step ? value + Math.sign(remainder) * (step - Math.abs(remainder)) : value - remainder,
    step,
  );
  if (!isNaN(min)) {
    if (snappedValue < min) snappedValue = min;
    else if (!isNaN(max) && snappedValue > max) snappedValue = min + Math.floor(roundToStepPrecision((max - min) / step, step)) * step;
  } else if (!isNaN(max) && snappedValue > max) snappedValue = Math.floor(roundToStepPrecision(max / step, step)) * step;
  return roundToStepPrecision(snappedValue, step);
}

/** Rounds `value` to `digits` digits in `base`. */
export function toFixedNumber(value: number, digits: number, base: number = 10): number {
  const pow = Math.pow(base, digits);
  return Math.round(value * pow) / pow;
}

// --- labels, descriptions, form reset -------------------------------------------------------------

export interface LabelingProps {
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

/**
 * react-aria `useLabels`: with both `aria-label` and `aria-labelledby`, the element labels itself too
 * (its own id joins `aria-labelledby`, so both are read); id lists are normalized; without any label
 * `defaultLabel` becomes `aria-label`. Pure (an `id` is created when missing).
 */
export function useLabels(props: LabelingProps, defaultLabel?: string): LabelingProps {
  let { id, "aria-label": label, "aria-labelledby": labelledBy } = props;
  id = id || createId();
  if (labelledBy && label) labelledBy = [...new Set([id, ...labelledBy.trim().split(/\s+/)])].join(" ");
  else if (labelledBy) labelledBy = labelledBy.trim().split(/\s+/).join(" ");
  if (!label && !labelledBy && defaultLabel) label = defaultLabel;
  return { id, "aria-label": label, "aria-labelledby": labelledBy };
}

let descriptionId = 0;
const descriptionNodes = new Map<string, { refCount: number; element: Element }>();

/**
 * react-aria `useDescription`: a shared hidden element holding `description` (one per distinct text,
 * reference counted) for `aria-describedby`. Browser only: call from a client effect / handler with
 * the element to describe; returns the cleanup (removes the attribute, drops the shared node when
 * unused). Server-rendered markup should render its own description element instead.
 */
export function useDescription(element: Element, description?: string): () => void {
  if (!description) return () => {};
  const doc = element.ownerDocument;
  let desc = descriptionNodes.get(description);
  if (!desc || !desc.element.isConnected) {
    const node = doc.createElement("div");
    node.id = `rv-description-${descriptionId++}`;
    (node as HTMLElement).style.display = "none";
    node.textContent = description;
    doc.body.appendChild(node);
    desc = { refCount: 0, element: node };
    descriptionNodes.set(description, desc);
  }
  desc.refCount++;
  element.setAttribute("aria-describedby", desc.element.id);
  const d = desc;
  return () => {
    if (element.getAttribute("aria-describedby") === d.element.id) element.removeAttribute("aria-describedby");
    if (--d.refCount === 0) {
      d.element.remove();
      descriptionNodes.delete(description);
    }
  };
}

/**
 * react-aria `useFormReset`: when the field's form resets (and the reset was not cancelled), call
 * `onReset(initialValue)`. Returns the cleanup. Call from a client effect, or from the first handler
 * that needs it (a resumed page's form reset needs no JS when the value lives in the DOM).
 */
export function useFormReset<T>(
  field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null | undefined,
  initialValue: T,
  onReset: (value: T) => void,
): () => void {
  const form = field?.form;
  if (!form) return () => {};
  const handleReset = (event: Event) => {
    if (onReset && !event.defaultPrevented) onReset(initialValue);
  };
  form.addEventListener("reset", handleReset);
  return () => form.removeEventListener("reset", handleReset);
}

/**
 * react-aria `useUpdateEffect`: run `fn` when `deps()` changes after the first run (the first run only
 * subscribes). Values compare with `Object.is` per position. Returns the disposer.
 */
export function updateEffect(deps: () => readonly unknown[], fn: () => void | (() => void)): Disposer {
  let previous: readonly unknown[] | null = null;
  let cleanup: void | (() => void);
  const dispose = effect(() => {
    const next = deps();
    if (previous && (previous.length !== next.length || next.some((dep, i) => !Object.is(dep, previous![i])))) {
      if (typeof cleanup === "function") cleanup();
      cleanup = untrack(fn);
    }
    previous = next;
  });
  return () => {
    dispose();
    if (typeof cleanup === "function") cleanup();
  };
}

export { renderElement, type DOMRenderFunction, type DOMRenderProps } from "./render.ts";
