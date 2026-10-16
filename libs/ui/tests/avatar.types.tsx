// Type-level tests, checked by `tsc -p libs/ui`: Avatar parts + variant unions.
import { Avatar } from "../src/components/avatar/index.ts";

export const Pic = () => (
  <Avatar size="lg" color="accent" variant="soft" class="x" ref={(el: HTMLSpanElement) => void el}>
    <Avatar.Image src="/a.png" alt="A" loading="lazy" onLoadingStatusChange={(s) => void s.length} />
    <Avatar.Fallback color="warning" delayMs={100}>
      A
    </Avatar.Fallback>
  </Avatar>
);

// @ts-expect-error bad avatar size
export const BadSize = () => <Avatar size="xl" />;
