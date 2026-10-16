// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/pagination/custom-icons.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { ArrowLeft, ArrowRight } from "lucide";
import { signal } from "@rivetjs/reactivity";
import { Pagination } from "@rivetjs/ui/pagination";

export const head = { title: "Pagination: Custom Icons" };

// #region demo

export function PaginationCustomIcons() {
  const page = signal(1);
  const totalPages = 3;

  return (
    <Pagination class="justify-center">
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous isDisabled={page() === 1} onPress={() => page.update((p) => p - 1)}>
            <Pagination.PreviousIcon>
              <Icon icon={ArrowLeft} size={16} />
            </Pagination.PreviousIcon>
            <span>Back</span>
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
            <span>Forward</span>
            <Pagination.NextIcon>
              <Icon icon={ArrowRight} size={16} />
            </Pagination.NextIcon>
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
      <PaginationCustomIcons />
    </div>
  );
}
