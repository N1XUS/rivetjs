// Rivet-authored HoverCard demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Avatar } from "@rivetjs/ui/avatar";
import { HoverCard } from "@rivetjs/ui/hover-card";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";

export const head = { title: "HoverCard: Controlled" };

// #region demo
export function Controlled() {
  const open = signal(false);
  return (
    <div id="hc-controlled" class="flex flex-col items-center gap-4 text-sm">
      <HoverCard isOpen={open}>
        <HoverCard.Trigger class="font-medium text-accent">@mara</HoverCard.Trigger>
        <HoverCard.Content aria-label="Mara Lindqvist">
          <div class="flex w-64 flex-col gap-3">
            <div class="flex items-center gap-3">
              <Avatar>
                <Avatar.Image alt="Mara Lindqvist" src={avatarBlueImage.src} />
                <Avatar.Fallback>ML</Avatar.Fallback>
              </Avatar>
              <div class="flex flex-col">
                <span class="font-medium">Mara Lindqvist</span>
                <span class="text-xs text-muted">@mara · Design systems</span>
              </div>
            </div>
            <p class="text-muted">Builds component libraries and writes about typography on the web.</p>
          </div>
        </HoverCard.Content>
      </HoverCard>
      <div class="flex items-center gap-2">
        <Button id="hc-controlled-toggle" size="sm" variant="secondary" onPress={() => open.set(!open())}>
          {() => (open() ? "Hide card" : "Show card")}
        </Button>
        <span id="hc-controlled-state" class="text-muted">
          {() => (open() ? "Open" : "Closed")}
        </span>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-end justify-center p-6 pb-10">
      <Controlled />
    </div>
  );
}
