// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/pagination/simple-prev-next.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Pagination } from "@rivetjs/ui/pagination";

export const head = { title: "Pagination: Simple (Previous / Next)" };

// #region demo

export function PaginationSimplePrevNext() {
  const page = signal(1);
  const totalPages = 10;
  const itemsPerPage = 5;
  const totalItems = 50;

  const startItem = () => (page() - 1) * itemsPerPage + 1;
  const endItem = () => Math.min(page() * itemsPerPage, totalItems);

  return (
    <Pagination class="w-full">
      <Pagination.Summary>
        {startItem()} to {endItem()} of {totalItems} invoices
      </Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous isDisabled={page() === 1} onPress={() => page.update((p) => p - 1)}>
            <Pagination.PreviousIcon />
            <span>Prev</span>
          </Pagination.Previous>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Next isDisabled={page() === totalPages} onPress={() => page.update((p) => p + 1)}>
            <span>Next</span>
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <PaginationSimplePrevNext />
    </div>
  );
}
