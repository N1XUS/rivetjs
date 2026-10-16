// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/pagination/with-ellipsis.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Pagination } from "@rivetjs/ui/pagination";

export const head = { title: "Pagination: With Ellipsis" };

// #region demo

export function PaginationWithEllipsis() {
  const page = signal(1);
  const totalPages = 12;

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];

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

    return pages;
  };

  return (
    <div class="w-full max-w-2xs overflow-x-auto sm:max-w-full">
      <Pagination class="justify-center">
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
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <PaginationWithEllipsis />
    </div>
  );
}
