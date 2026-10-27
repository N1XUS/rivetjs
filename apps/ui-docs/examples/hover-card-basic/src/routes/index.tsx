// Rivet-authored HoverCard demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Avatar } from "@rivetjs/ui/avatar";
import { HoverCard } from "@rivetjs/ui/hover-card";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";

export const head = { title: "HoverCard: Usage" };

// #region demo
export function Basic() {
  return (
    <p id="hc-basic" class="text-sm">
      Reviewed by{" "}
      <HoverCard>
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
    </p>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-end justify-center p-6 pb-10">
      <Basic />
    </div>
  );
}
