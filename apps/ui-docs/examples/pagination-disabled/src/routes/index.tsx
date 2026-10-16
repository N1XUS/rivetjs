// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/pagination/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Pagination } from "@rivetjs/ui/pagination";

export const head = { title: "Pagination: Disabled" };

// #region demo

export function PaginationDisabled() {
  const page = signal(1);
  const totalPages = 3;

  return (
    <Pagination class="justify-center">
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous isDisabled onPress={() => page.update((p) => p - 1)}>
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
          <Pagination.Next isDisabled onPress={() => page.update((p) => p + 1)}>
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
      <PaginationDisabled />
    </div>
  );
}
