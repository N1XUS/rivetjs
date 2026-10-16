// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/avatar/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Avatar } from "@rivetjs/ui/avatar";
import avatarPerson3Image from "../assets/avatar-person-3.jpg?image";

export const head = { title: "Avatar: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <Avatar class="rounded-lg">
      <Avatar.Image alt="John Doe" src={avatarPerson3Image.src} />
      <Avatar.Fallback class="rounded-lg">JD</Avatar.Fallback>
    </Avatar>
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
