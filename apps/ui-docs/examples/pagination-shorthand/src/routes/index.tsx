// Rivet addition (no upstream demo): Pagination shorthand: `total` + a Signal `page`.
import { signal } from "@rivetjs/reactivity";
import { Pagination } from "@rivetjs/ui/pagination";

export const head = { title: "Pagination: Shorthand" };

// #region demo
export function Shorthand() {
  const page = signal(1);

  return (
    <div class="flex flex-col items-center gap-3">
      <Pagination total={12} page={page} />
      <p id="pagination-shorthand-page" class="text-sm text-muted">
        Page {page()} of 12
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Shorthand />
    </div>
  );
}
