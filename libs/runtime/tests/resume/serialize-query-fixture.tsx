// `importResume` with a URL that already carries a query (serialize-and-revive.test.ts): a component-like function whose
// closure resumes through its compiled browser symbol.
import { signal } from "@rivetjs/reactivity";

export function Tally() {
  const n = signal(0);
  const add = () => {
    n.set(n() + 1);
    return n();
  };
  return { n, add };
}
