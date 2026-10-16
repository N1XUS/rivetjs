import { signal } from "@rivetjs/reactivity";
import { Virtualizer, ListLayout } from "@rivetjs/cdk/virtualizer";

export const head = { title: "Virtualizer: horizontal and RTL" };

const days = Array.from({ length: 1000 }, (_, i) => i + 1);

// #region demo
export default function Timeline() {
  const ltrLeft = signal(0);
  const rtlLeft = signal(0);
  return (
    <section class="stack">
      <Virtualizer
        id="ltr"
        dir="ltr"
        role="list"
        label="Days"
        tabIndex={0}
        scrollDirection="horizontal"
        items={days}
        layout={() => new ListLayout()}
        layoutOptions={{ orientation: "horizontal", rowSize: 64 }}
        initialSize={{ width: 320, height: 56 }}
        style={{ width: "320px", height: "56px" }}
        onScroll={(event) => ltrLeft.set((event.currentTarget as HTMLElement).scrollLeft)}
      >
        {(day) => <div class="col">Day {day()}</div>}
      </Virtualizer>
      <p>
        <output id="ltr-left">scrollLeft: {ltrLeft()}</output>{" "}
        <button id="ltr-far" type="button" onClick={() => (document.getElementById("ltr")!.scrollLeft = 1920)}>
          Day 31
        </button>
      </p>
      <Virtualizer
        id="rtl"
        dir="rtl"
        role="list"
        label="ימים"
        tabIndex={0}
        scrollDirection="horizontal"
        items={days}
        layout={() => new ListLayout()}
        layoutOptions={{ orientation: "horizontal", rowSize: 64 }}
        initialSize={{ width: 320, height: 56 }}
        style={{ width: "320px", height: "56px" }}
        onScroll={(event) => rtlLeft.set((event.currentTarget as HTMLElement).scrollLeft)}
      >
        {(day) => <div class="col">{day()}</div>}
      </Virtualizer>
      <p>
        <output id="rtl-left">scrollLeft: {rtlLeft()}</output>{" "}
        <button id="rtl-far" type="button" onClick={() => (document.getElementById("rtl")!.scrollLeft = -1920)}>
          Day 31
        </button>
      </p>
    </section>
  );
}
// #endregion
