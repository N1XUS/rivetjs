// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/badge/variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Avatar } from "@rivetjs/ui/avatar";
import { Badge } from "@rivetjs/ui/badge";
import { Separator } from "@rivetjs/ui/separator";
import avatarGreenImage from "../assets/avatar-green.jpg?image";

export const head = { title: "Badge: Variants" };

// #region demo
const AVATAR_URL = avatarGreenImage.src;

export function BadgeVariants() {
  const variants = ["primary", "secondary", "soft"] as const;
  const colors = ["accent", "default", "success", "warning", "danger"] as const;

  return (
    <div class="flex flex-col gap-8">
      {variants.map((variant, index) => (
        <>
          <div class="flex flex-col gap-4">
            <h3 class="text-sm font-semibold text-muted capitalize">{variant}</h3>
            <div class="flex items-center gap-6">
              {colors.map((color) => (
                <Badge.Anchor>
                  <Avatar>
                    <Avatar.Image src={AVATAR_URL} />
                    <Avatar.Fallback>JD</Avatar.Fallback>
                  </Avatar>
                  <Badge color={color} size="sm" variant={variant}>
                    5
                  </Badge>
                </Badge.Anchor>
              ))}
            </div>
          </div>
          {index < variants.length - 1 && <Separator />}
        </>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <BadgeVariants />
    </div>
  );
}
