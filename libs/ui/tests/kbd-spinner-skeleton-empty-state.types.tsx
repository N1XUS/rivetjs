// Type-level tests, checked by `tsc -p libs/ui`: wave-1 display components keep HeroUI's generic signatures.
import { EmptyState } from "../src/components/empty-state/index.ts";
import { Kbd } from "../src/components/kbd/index.ts";
import type { KbdKey } from "../src/components/kbd/index.ts";
import { Skeleton } from "../src/components/skeleton/index.ts";
import { Spinner } from "../src/components/spinner/index.ts";

const key: KbdKey = "command";

export const Display = () => (
  <>
    <Kbd variant="light" class="x" ref={(el: HTMLElement) => void el}>
      <Kbd.Abbr keyValue={key} ref={(el: HTMLElement) => void el} />
      <Kbd.Content>K</Kbd.Content>
    </Kbd>
    <Spinner size="xl" color="current" ref={(el: HTMLElement) => void el} />
    <Skeleton animationType="none" class="h-3" />
    <EmptyState class="p-2" />
    <Spinner<"div"> ref={(el: HTMLElement) => void el} />
  </>
);

// @ts-expect-error bad kbd key
export const BadKey = () => <Kbd.Abbr keyValue="nope" />;
// @ts-expect-error bad spinner size
export const BadSize = () => <Spinner size="huge" />;
