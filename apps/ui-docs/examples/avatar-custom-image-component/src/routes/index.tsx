// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/avatar/custom-image-component.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Avatar } from "@rivetjs/ui/avatar";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";

export const head = { title: "Avatar: Custom Image Component" };

// #region demo
const SRC = avatarBlueImage.src;

// Not yet ported: upstream passes `asChild` and renders Next.js `<Image>` inside `Avatar.Image`. The Rivet avatar has
// no `asChild` (and there is no Next.js), so the image renders through `Avatar.Image` itself.
export function CustomImageComponent() {
  return (
    <Avatar>
      <Avatar.Image alt="John Doe" height={40} src={SRC} width={40} />
      <Avatar.Fallback>JD</Avatar.Fallback>
    </Avatar>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomImageComponent />
    </div>
  );
}
