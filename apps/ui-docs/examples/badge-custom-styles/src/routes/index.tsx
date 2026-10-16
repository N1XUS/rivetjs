// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/badge/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Avatar } from "@rivetjs/ui/avatar";
import { Badge } from "@rivetjs/ui/badge";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";

export const head = { title: "Badge: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <Badge.Anchor>
      <Avatar>
        <Avatar.Image alt="Kate Wilson" src={avatarBlueImage.src} />
        <Avatar.Fallback>KW</Avatar.Fallback>
      </Avatar>
      <Badge class="min-w-5 font-semibold tabular-nums" color="accent" size="sm" variant="soft">
        5
      </Badge>
    </Badge.Anchor>
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
