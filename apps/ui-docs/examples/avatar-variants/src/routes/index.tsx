// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/avatar/variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { Icon } from "@rivetjs/kit/icon";
import { User } from "lucide";
import { Avatar } from "@rivetjs/ui/avatar";
import { Separator } from "@rivetjs/ui/separator";
import avatarPerson3Image from "../assets/avatar-person-3.jpg?image";
import avatarPerson4Image from "../assets/avatar-person-4.jpg?image";
import avatarPerson5Image from "../assets/avatar-person-5.jpg?image";
import avatarPerson8Image from "../assets/avatar-person-8.jpg?image";
import avatarPerson16Image from "../assets/avatar-person-16.jpg?image";

export const head = { title: "Avatar: Variants" };

// #region demo
export function Variants() {
  const colors = ["accent", "default", "success", "warning", "danger"] as const;
  // Rivet: JSX builds DOM nodes, so the icon content is a function (one icon per avatar), not a shared element.
  const variants = [
    { content: () => "AG", label: "letter", type: "letter" },
    { content: () => "AG", label: "letter soft", type: "letter-soft" },
    { content: () => <Icon icon={User} size={16} />, label: "icon", type: "icon" },
    { content: () => <Icon icon={User} size={16} />, label: "icon soft", type: "icon-soft" },
    {
      content: [avatarPerson3Image.src, avatarPerson4Image.src, avatarPerson5Image.src, avatarPerson8Image.src, avatarPerson16Image.src],
      label: "img",
      type: "img",
    },
  ] as const;

  return (
    <div class="flex flex-col gap-4">
      {/* Color labels header */}
      <div class="flex items-center gap-3">
        <div class="w-24 shrink-0" />
        {colors.map((color) => (
          <div class="flex w-20 shrink-0 items-center justify-center">
            <span class="text-xs text-muted capitalize">{color}</span>
          </div>
        ))}
      </div>

      <Separator />

      {/* Variant rows */}
      {variants.map((variant) => (
        <div class="flex items-center gap-3">
          <div class="w-24 shrink-0 text-sm text-muted">{variant.label}</div>
          {colors.map((color, colorIndex) => (
            <div class="flex w-20 shrink-0 items-center justify-center">
              <Avatar color={color} variant={variant.type.includes("soft") ? "soft" : undefined}>
                {Array.isArray(variant.content) ? (
                  <>
                    <Avatar.Image alt={`Avatar ${color}`} src={variant.content[colorIndex]} />
                    <Avatar.Fallback>{color.charAt(0).toUpperCase()}</Avatar.Fallback>
                  </>
                ) : (
                  <Avatar.Fallback>{(variant.content as () => Content)()}</Avatar.Fallback>
                )}
              </Avatar>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Variants />
    </div>
  );
}
