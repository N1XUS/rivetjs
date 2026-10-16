// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/pagination/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Pagination } from "@rivetjs/ui/pagination";

export const head = { title: "Pagination: Tailwind CSS" };

// #region demo

const linkClass = "text-muted hover:bg-surface hover:text-foreground";
const activeClass = "bg-accent text-accent-foreground hover:bg-accent-hover";

export function CustomStyles() {
  const page = signal(2);

  return (
    <Pagination class="justify-center">
      <Pagination.Content class="gap-1 rounded-xl bg-default p-1">
        <Pagination.Item>
          <Pagination.Previous class={linkClass} isDisabled={page() === 1} onPress={() => page.update((p) => p - 1)}>
            <Pagination.PreviousIcon />
          </Pagination.Previous>
        </Pagination.Item>
        {[1, 2, 3].map((p) => (
          <Pagination.Item>
            <Pagination.Link class={p === page() ? activeClass : linkClass} isActive={p === page()} onPress={() => page.set(p)}>
              {p}
            </Pagination.Link>
          </Pagination.Item>
        ))}
        <Pagination.Item>
          <Pagination.Next class={linkClass} isDisabled={page() === 3} onPress={() => page.update((p) => p + 1)}>
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
      <CustomStyles />
    </div>
  );
}
