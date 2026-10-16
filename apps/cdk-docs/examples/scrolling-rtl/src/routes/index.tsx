import { signal } from "@rivetjs/reactivity";
import { CdkScrollable, getRtlScrollAxisType, RtlScrollAxisType, supportsScrollBehavior, type ExtendedScrollToOptions } from "@rivetjs/cdk/scrolling";

export const head = { title: "CdkScrollable: RTL" };

// #region demo
export default function Track() {
  const axis = signal("");
  const offsets = signal("not measured");
  const scroll = (options: ExtendedScrollToOptions) => {
    // A CdkScrollable over the element; its direction comes from the dir="rtl" ancestor.
    const scrollable = new CdkScrollable(document.getElementById("rtl-track")!);
    scrollable.scrollTo(options);
    const type = getRtlScrollAxisType();
    axis.set(
      `${Object.keys(RtlScrollAxisType).find((k) => RtlScrollAxisType[k as keyof typeof RtlScrollAxisType] === type)}, smooth scrolling ${supportsScrollBehavior() ? "supported" : "not supported"}`,
    );
    const m = (edge: "start" | "end" | "left" | "right" | "top" | "bottom") => `${edge} ${Math.round(scrollable.measureScrollOffset(edge))}`;
    offsets.set([m("start"), m("end"), m("left"), m("right"), m("top"), m("bottom")].join(", "));
  };
  return (
    <section class="stack" dir="rtl">
      <p class="buttons">
        <button id="rtl-start-100" type="button" onClick={() => scroll({ start: 100 })}>
          start: 100
        </button>
        <button id="rtl-end-0" type="button" onClick={() => scroll({ end: 0 })}>
          end: 0
        </button>
        <button id="rtl-bottom-0" type="button" onClick={() => scroll({ bottom: 0 })}>
          bottom: 0
        </button>
        <button id="rtl-start-0" type="button" onClick={() => scroll({ start: 0, top: 0 })}>
          start: 0, top: 0
        </button>
      </p>
      <div id="rtl-track" class="track">
        <div class="wide"></div>
      </div>
      <output id="rtl-axis" dir="ltr">
        RTL axis type: {axis()}
      </output>
      <output id="rtl-offsets" dir="ltr">
        {offsets()}
      </output>
    </section>
  );
}
// #endregion
