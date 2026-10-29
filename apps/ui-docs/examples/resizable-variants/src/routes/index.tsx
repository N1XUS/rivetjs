// Rivet-authored Resizable demo (independent implementation).
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@rivetjs/ui/resizable";

export const head = { title: "Resizable: Variants" };

const VARIANTS = [
  { variant: "primary", surface: "bg-background" },
  { variant: "secondary", surface: "bg-surface" },
  { variant: "tertiary", surface: "bg-surface-tertiary" },
] as const;

// #region demo
export function ResizableVariants() {
  return (
    <div class="flex w-full max-w-md flex-col gap-4">
      {VARIANTS.map(({ variant, surface }) => (
        <ResizablePanelGroup orientation="horizontal" class={`min-h-[88px] rounded-xl border border-separator ${surface}`}>
          <ResizablePanel id={`${variant}-a`} defaultSize="40%">
            <div class="flex h-full items-center justify-center p-4 text-sm">{variant}</div>
          </ResizablePanel>
          <ResizableHandle id={`${variant}-handle`} variant={variant} withIndicator />
          <ResizablePanel id={`${variant}-b`} defaultSize="60%">
            <div class="flex h-full items-center justify-center p-4 text-sm text-muted">Content</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ResizableVariants />
    </div>
  );
}
