import { signal } from "@rivetjs/reactivity";
import type { LayoutProps } from "@rivetjs/router";

// LAZY-FLIP (`../../client.ts`): one non-row control on every page — the first click on it boots the resume runtime
// without touching a collection row.
export default function Layout({ children }: LayoutProps) {
  const clicks = signal(0);
  return (
    <main>
      <button id="bench-ctl" type="button" onClick={() => clicks.set(clicks() + 1)}>
        Bench
      </button>
      <output id="bench-out">{clicks()}</output>
      {children}
    </main>
  );
}
