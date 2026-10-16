import { Toolbar } from "@rivetjs/cdk/toolbar";

export const head = { title: "Vertical and right-to-left toolbars" };

// #region demo
const toolbar = "flex w-max gap-1 rounded-lg border border-slate-300 p-1 orientation-vertical:flex-col";
const button = "rounded border border-slate-300 px-2 py-1 focus-visible:outline-2 focus-visible:outline-teal-600";

export default function Vertical() {
  return (
    <section class="m-4 flex items-start gap-8 text-sm">
      <Toolbar id="vt" aria-label="Clipboard" orientation="vertical" class={toolbar}>
        <button type="button" id="vt-cut" class={button}>
          Cut
        </button>
        <button type="button" id="vt-copy" class={button}>
          Copy
        </button>
        <button type="button" id="vt-paste" class={button}>
          Paste
        </button>
      </Toolbar>
      <div dir="rtl">
        <Toolbar id="rt" aria-label="عربي" class={toolbar}>
          <button type="button" id="rt-one" class={button}>
            واحد
          </button>
          <button type="button" id="rt-two" class={button}>
            اثنان
          </button>
        </Toolbar>
      </div>
    </section>
  );
}
// #endregion
