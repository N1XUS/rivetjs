import { signal } from "@rivetjs/reactivity";
import type { LayoutProps } from "@rivetjs/router";
import { Link } from "@rivetjs/router/client";

// rivet-resume lane: nested layout (inside the root `_layout.tsx`) with its own state, a handler and
// client-routed links — part of the resumable work the lane measures.
export default function ResumeLayout({ children }: LayoutProps) {
  const visits = signal(0);
  return (
    <div data-layout="resume">
      <nav>
        <Link to="/resume?rows=10">Ten rows</Link> <Link to="/page">Static page</Link>{" "}
        <button type="button" onClick={() => visits.update((n) => n + 1)}>
          Visits {visits()}
        </button>
      </nav>
      {children}
    </div>
  );
}
