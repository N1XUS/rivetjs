// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/badge/placements.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Avatar } from "@rivetjs/ui/avatar";
import { Badge } from "@rivetjs/ui/badge";
import avatarGreenImage from "../assets/avatar-green.jpg?image";

export const head = { title: "Badge: Placements" };

// #region demo
const AVATAR_URL = avatarGreenImage.src;

export function BadgePlacements() {
  const placements = ["top-right", "top-left", "bottom-right", "bottom-left"] as const;

  return (
    <div class="flex items-center gap-8">
      {placements.map((placement) => (
        <div class="flex flex-col items-center gap-2">
          <Badge.Anchor>
            <Avatar>
              <Avatar.Image src={AVATAR_URL} />
              <Avatar.Fallback>JD</Avatar.Fallback>
            </Avatar>
            <Badge color="accent" placement={placement} size="sm" />
          </Badge.Anchor>
          <span class="text-xs text-muted">{placement}</span>
        </div>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <BadgePlacements />
    </div>
  );
}
