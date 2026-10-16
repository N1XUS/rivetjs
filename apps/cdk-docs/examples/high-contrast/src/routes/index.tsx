import { signal } from "@rivetjs/reactivity";
import { getHighContrastModeDetector, HighContrastMode } from "@rivetjs/cdk/a11y/high-contrast";

export const head = { title: "HighContrastModeDetector" };

const names = { [HighContrastMode.NONE]: "none", [HighContrastMode.BLACK_ON_WHITE]: "black on white", [HighContrastMode.WHITE_ON_BLACK]: "white on black" };

// #region demo
export default function Contrast() {
  const mode = signal("not checked");
  const detect = () => {
    const detector = getHighContrastModeDetector();
    mode.set(names[detector.getHighContrastMode()]);
    // Adds cdk-high-contrast-active + the theme class to <body> in high-contrast mode.
    detector._applyBodyHighContrastModeCssClasses();
  };
  return (
    <section class="m-4 flex items-center gap-3 text-sm">
      <button id="detect" type="button" class="hc-button rounded border border-slate-300 px-2 py-1" onClick={detect}>
        Detect
      </button>
      <output id="mode">Mode: {mode()}</output>
    </section>
  );
}
// #endregion
