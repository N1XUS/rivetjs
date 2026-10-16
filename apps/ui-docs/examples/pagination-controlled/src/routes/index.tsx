// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/pagination/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Pagination } from "@rivetjs/ui/pagination";

export const head = { title: "Pagination: Controlled" };

// #region demo

export function PaginationControlled() {
  const page = signal(1);
  const totalPages = 12;
  const itemsPerPage = 10;
  const totalItems = 120;

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (page() > 3) {
        pages.push("ellipsis");
      }

      const start = Math.max(2, page() - 1);
      const end = Math.min(totalPages - 1, page() + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (page() < totalPages - 2) {
        pages.push("ellipsis");
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const startItem = () => (page() - 1) * itemsPerPage + 1;
  const endItem = () => Math.min(page() * itemsPerPage, totalItems);

  return (
    <Pagination>
      <Pagination.Summary>
        Showing {startItem()}-{endItem()} of {totalItems} results
      </Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous isDisabled={page() === 1} onPress={() => page.update((p) => p - 1)}>
            <Pagination.PreviousIcon />
            <span>Previous</span>
          </Pagination.Previous>
        </Pagination.Item>
        {getPageNumbers().map((p, i) =>
          p === "ellipsis" ? (
            <Pagination.Item>
              <Pagination.Ellipsis />
            </Pagination.Item>
          ) : (
            <Pagination.Item>
              <Pagination.Link isActive={p === page()} onPress={() => page.set(p)}>
                {p}
              </Pagination.Link>
            </Pagination.Item>
          ),
        )}
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
      <PaginationControlled />
    </div>
  );
}
