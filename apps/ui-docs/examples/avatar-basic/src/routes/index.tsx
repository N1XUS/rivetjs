// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/avatar/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Avatar } from "@rivetjs/ui/avatar";
import avatarPerson3Image from "../assets/avatar-person-3.jpg?image";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";

export const head = { title: "Avatar: Usage" };

// #region demo
export function Basic() {
  return (
    <div class="flex items-center gap-4">
      <Avatar>
        <Avatar.Image alt="John Doe" src={avatarPerson3Image.src} />
        <Avatar.Fallback>JD</Avatar.Fallback>
      </Avatar>
      <Avatar>
        <Avatar.Image alt="Blue" src={avatarBlueImage.src} />
        <Avatar.Fallback>B</Avatar.Fallback>
      </Avatar>
      <Avatar>
        <Avatar.Fallback>JR</Avatar.Fallback>
      </Avatar>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
