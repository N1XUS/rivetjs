// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/scroll-shadow/hide-scroll-bar.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ScrollShadow } from "@rivetjs/ui/scroll-shadow";

export const head = { title: "ScrollShadow: Hide Scroll Bar" };

// #region demo
export function HideScrollBar() {
  return (
    <div class="w-full p-0 sm:max-w-sm">
      <ScrollShadow hideScrollBar class="max-h-[240px] p-4">
        <div class="space-y-4">
          {Array.from({ length: 10 }).map(() => (
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam pulvinar risus non risus hendrerit venenatis. Pellentesque sit amet hendrerit
              risus, sed porttitor quam. Morbi accumsan cursus enim, sed ultricies sapien.
            </p>
          ))}
        </div>
      </ScrollShadow>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <HideScrollBar />
    </div>
  );
}
