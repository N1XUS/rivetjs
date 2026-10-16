import { Motion1D, type Motion1DType } from "@rivetjs/cdk/motion";

export const head = { title: "Motion1D: embla's motion on any value" };

// #region demo
export default function MotionDemo() {
  const motion: { current?: Motion1DType } = {};
  const moveTo = (x: number) => {
    const knob = document.getElementById("knob")!;
    // Numbers in, numbers out: render() receives the interpolated value every frame.
    motion.current ??= Motion1D({
      value: 0,
      render: (value) => (knob.style.transform = `translateX(${value}px)`),
      onSettle: () => knob.setAttribute("data-settled", String(Math.round(motion.current!.get()))),
    });
    knob.removeAttribute("data-settled");
    motion.current.to(x);
  };
  return (
    <div class="m-4 w-80 text-sm">
      <div class="relative h-10 rounded-full bg-slate-100">
        <div id="knob" class="absolute top-1 left-1 h-8 w-8 rounded-full bg-indigo-600 shadow" />
      </div>
      <div class="mt-3 flex gap-2">
        <button id="to-start" type="button" class="rounded-md border border-slate-300 px-3 py-1" onClick={() => moveTo(0)}>
          Start
        </button>
        <button id="to-middle" type="button" class="rounded-md border border-slate-300 px-3 py-1" onClick={() => moveTo(136)}>
          Middle
        </button>
        <button id="to-end" type="button" class="rounded-md border border-slate-300 px-3 py-1" onClick={() => moveTo(272)}>
          End
        </button>
      </div>
    </div>
  );
}
// #endregion
