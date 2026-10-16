import { Toolbar } from "@rivetjs/cdk/toolbar";

export const head = { title: "Vertical and RTL Toolbar" };

// #region demo
export default function Orientation() {
  return (
    <section class="m-4 flex items-start gap-8 text-sm">
      <Toolbar id="tools-v" aria-label="Drawing tools" orientation="vertical" class="flex flex-col gap-1">
        <button type="button" id="v-pen">
          Pen
        </button>
        <button type="button" id="v-eraser">
          Eraser
        </button>
        <button type="button">Fill</button>
      </Toolbar>
      <div dir="rtl">
        <Toolbar aria-label="أدوات" class="flex gap-1">
          <button type="button" id="r-one">
            واحد
          </button>
          <button type="button" id="r-two">
            اثنان
          </button>
        </Toolbar>
      </div>
    </section>
  );
}
// #endregion
