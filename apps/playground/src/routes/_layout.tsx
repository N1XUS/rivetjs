import { signal } from "@rivetjs/reactivity";
import { clientOnly } from "@rivetjs/runtime/dom";
import type { LayoutProps } from "@rivetjs/router";
import type { CompiledElement } from "@rivetjs/runtime/jsx-runtime";
import { Picture, ImagePreload } from "@rivetjs/runtime/image";
import { PageViews } from "../page-views.js";
import hero from "../assets/hero.jpg?preset=hero&image";

const BrowserWidget = clientOnly(() => import("../browser-widget.js"), undefined, {
  fallback: () => <p class="text-sm text-slate-500">Browser tools load in the browser.</p>,
});

/** Site frame. The root layout stays mounted across client navigation, so the counter keeps its state. */
export default function Layout({ url, children }: LayoutProps) {
  const count = signal(0);
  // Called rather than rendered as elements: a component element in a resume module compiles to a
  // region symbol, which would ship the image markup code in the layout chunk; a static value does not.
  const banner = [
    ImagePreload({ image: hero }),
    Picture({ image: hero, alt: "", priority: true, class: "mb-8 h-auto w-full rounded-xl" }),
  ] as unknown as CompiledElement[];
  return (
    <main class="mx-auto max-w-3xl px-6 py-12 text-slate-900">
      <header class="mb-10 border-b border-slate-200 pb-8">
        {banner}
        <p class="mb-3 text-sm font-semibold uppercase tracking-widest text-teal-700">Compiled views · explicit ownership</p>
        <p class="text-4xl font-bold tracking-tight">
          <a href="/">Rivet playground</a>
        </p>
        <p class="mt-4 max-w-xl text-base leading-7 text-slate-600">
          One small application, rendered on the server and resumed in the browser. Data, ownership, and cancellation
          stay explicit.
        </p>
      </header>
      <section class="mb-8 rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="counter-title">
        <h2 id="counter-title" class="text-lg font-semibold">
          Owned state
        </h2>
        <p class="mt-2 text-sm text-slate-600">The browser counter updates without replacing the surrounding page.</p>
        <div class="mt-4 flex items-center gap-4">
          <button
            class="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white"
            type="button"
            onClick={() => count.update((value) => value + 1)}
          >
            Increase count
          </button>
          <output id="count" aria-live="polite" class="font-mono text-lg">
            {count()}
          </output>
        </div>
      </section>
      {children}
      <footer class="mt-10 border-t border-slate-200 pt-5">
        <BrowserWidget />
      </footer>
      <PageViews url={url} />
    </main>
  );
}
