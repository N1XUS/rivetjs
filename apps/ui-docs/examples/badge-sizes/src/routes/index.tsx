// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/badge/sizes.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Avatar } from "@rivetjs/ui/avatar";
import { Badge } from "@rivetjs/ui/badge";
import avatarGreenImage from "../assets/avatar-green.jpg?image";

export const head = { title: "Badge: Sizes" };

// #region demo
const AVATAR_URL = avatarGreenImage.src;

export function BadgeSizes() {
  const sizes = ["sm", "md", "lg"] as const;

  return (
    <div class="flex items-center gap-6">
      {sizes.map((size) => (
        <Badge.Anchor>
          <Avatar size={size}>
            <Avatar.Image src={AVATAR_URL} />
            <Avatar.Fallback>JD</Avatar.Fallback>
          </Avatar>
          <Badge color="danger" size={size}>
            5
          </Badge>
        </Badge.Anchor>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <BadgeSizes />
    </div>
  );
}
