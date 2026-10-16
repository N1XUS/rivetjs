// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/card/horizontal.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { CloseButton } from "@rivetjs/ui/close-button";
import cherriesImage from "../assets/cherries.jpg?image";

export const head = { title: "Card: Horizontal Layout" };

// #region demo
export function Horizontal() {
  return (
    <Card class="w-full items-stretch md:flex-row">
      <div class="relative h-[140px] w-full shrink-0 overflow-hidden rounded-2xl sm:h-[120px] sm:w-[120px]">
        <img
          alt="Cherries"
          class="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover select-none"
          loading="lazy"
          src={cherriesImage.src}
        />
      </div>
      <div class="flex flex-1 flex-col gap-3">
        <Card.Header class="gap-1">
          <Card.Title class="pe-8">Become an ACME Creator!</Card.Title>
          <Card.Description>Lorem ipsum dolor sit amet consectetur. Sed arcu donec id aliquam dolor sed amet faucibus etiam.</Card.Description>
          <CloseButton aria-label="Close banner" class="absolute end-3 top-3" />
        </Card.Header>
        <Card.Footer class="mt-auto flex w-full flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex flex-col">
            <span class="text-sm font-medium text-foreground">Only 10 spots</span>
            <span class="text-xs text-muted">Submission ends Oct 10.</span>
          </div>
          <Button class="w-full sm:w-auto">Apply Now</Button>
        </Card.Footer>
      </div>
    </Card>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Horizontal />
    </div>
  );
}
