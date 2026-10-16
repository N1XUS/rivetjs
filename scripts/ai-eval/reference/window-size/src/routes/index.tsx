import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";

export const head = { title: "Window" };

export default function Home() {
  const width = signal<number | null>(null);
  clientEffect(
    () => {
      width.set(innerWidth);
    },
    { when: "load" },
  );
  return (
    <main class="p-6" window:onResize={() => width.set(innerWidth)}>
      <p>
        Width: <span id="width">{width() ?? ""}</span>
      </p>
      <p>
        Size: <span id="size">{width() === null ? "" : width()! < 768 ? "narrow" : "wide"}</span>
      </p>
    </main>
  );
}
