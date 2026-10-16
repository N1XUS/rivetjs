// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/pagination/sizes.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Pagination } from "@rivetjs/ui/pagination";

export const head = { title: "Pagination: Sizes" };

// #region demo

function SizePagination({ size }: { size: "sm" | "md" | "lg" }) {
  const page = signal(1);
  const totalPages = 3;

  return (
    <div class="flex flex-col gap-2">
      <span class="text-xs font-medium text-muted capitalize">{size}</span>
      <Pagination class="justify-center" size={size}>
        <Pagination.Content>
          <Pagination.Item>
            <Pagination.Previous isDisabled={page() === 1} onPress={() => page.update((p) => p - 1)}>
              <Pagination.PreviousIcon />
              <span>Previous</span>
            </Pagination.Previous>
          </Pagination.Item>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Pagination.Item>
              <Pagination.Link isActive={p === page()} onPress={() => page.set(p)}>
                {p}
              </Pagination.Link>
            </Pagination.Item>
          ))}
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

export function PaginationSizes() {
  return (
    <div class="flex flex-col gap-6">
      {(["sm", "md", "lg"] as const).map((size) => (
        <SizePagination size={size} />
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <PaginationSizes />
    </div>
  );
}
