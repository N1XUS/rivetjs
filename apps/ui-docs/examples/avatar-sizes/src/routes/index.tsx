// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/avatar/sizes.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Avatar } from "@rivetjs/ui/avatar";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";
import avatarPurpleImage from "../assets/avatar-purple.jpg?image";
import avatarRedImage from "../assets/avatar-red.jpg?image";

export const head = { title: "Avatar: Sizes" };

// #region demo
export function Sizes() {
  return (
    <div class="flex items-center gap-4">
      <Avatar size="sm">
        <Avatar.Image alt="Small Avatar" src={avatarBlueImage.src} />
        <Avatar.Fallback>SM</Avatar.Fallback>
      </Avatar>
      <Avatar size="md">
        <Avatar.Image alt="Medium Avatar" src={avatarPurpleImage.src} />
        <Avatar.Fallback>MD</Avatar.Fallback>
      </Avatar>
      <Avatar size="lg">
        <Avatar.Image alt="Large Avatar" src={avatarRedImage.src} />
        <Avatar.Fallback>LG</Avatar.Fallback>
      </Avatar>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Sizes />
    </div>
  );
}
