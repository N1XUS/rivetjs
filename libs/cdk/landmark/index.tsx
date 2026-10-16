// Ported from react-aria (packages/react-aria/src/landmark/useLandmark.ts: useLandmark), Apache-2.0, © Adobe.
// Rivet:
// - `useLandmark(props, ref)` → `landmarkProps(props, ref)`: returns RA's `landmarkProps` bag (`tabIndex`
//   is a signal accessor); `ref` is a `ref()` (`Ref<T>`, read as `ref()` where RA reads `ref.current`).
//   Registration (RA: layout effect) is a resumable `clientEffect` with `when: "idle"`: a server-rendered
//   landmark registers once the page is idle; one rendered in the browser registers right after mounting.
//   `aria-label` may be an accessor (re-registers on change, as RA re-runs its effect on a new label).
// - The manager (document access) lives in `./manager.ts`, a plain module the server compile leaves alone.
import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import { registerLandmark, type AriaLandmarkProps, type LandmarkProps, type LandmarkRef } from "./manager.ts";

export {
  UNSTABLE_createLandmarkController,
  type AriaLandmarkProps,
  type AriaLandmarkRole,
  type LandmarkAria,
  type LandmarkController,
  type LandmarkControllerOptions,
  type LandmarkProps,
} from "./manager.ts";

/**
 * Provides landmark navigation in an application. Call this with a role and label to register a
 * landmark navigable with F6 (RA `useLandmark`; returns the `landmarkProps` bag).
 *
 * @param props - Props for the landmark.
 * @param ref - Ref to the landmark (`ref()`).
 */
export function landmarkProps(props: AriaLandmarkProps, ref: LandmarkRef): LandmarkProps {
  const { role, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledby, focus } = props;
  const isLandmarkFocused = signal(false);
  clientEffect(
    () => {
      const label = (typeof ariaLabel === "function" ? ariaLabel() : ariaLabel) || ariaLabelledby;
      if (!ref()) return;
      return registerLandmark(ref, role, label, focus, isLandmarkFocused);
    },
    { when: "idle" },
  );
  return {
    role,
    tabIndex: () => (isLandmarkFocused() ? -1 : undefined),
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
  };
}
