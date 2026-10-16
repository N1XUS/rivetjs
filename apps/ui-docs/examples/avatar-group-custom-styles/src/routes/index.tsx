// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/avatar-group/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { User } from "lucide";
import { Avatar } from "@rivetjs/ui/avatar";
import { AvatarGroup } from "@rivetjs/ui/avatar-group";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";
import avatarGreenImage from "../assets/avatar-green.jpg?image";
import avatarPurpleImage from "../assets/avatar-purple.jpg?image";

export const head = { title: "AvatarGroup: Tailwind CSS" };

// #region demo
const assignees = [
  {
    id: 1,
    image: avatarBlueImage.src,
    name: "John Doe",
  },
  {
    id: 2,
    image: avatarGreenImage.src,
    name: "Kate Wilson",
  },
  {
    id: 3,
    image: avatarPurpleImage.src,
    name: "Emily Chen",
  },
] as const;

export function CustomStyles() {
  return (
    <div class="inline-flex items-center gap-2.5 rounded-full border border-border/70 bg-surface/95 py-1 pr-3 pl-1 shadow-sm ring-1 ring-black/[0.04] dark:border-border/80 dark:bg-surface/90 dark:ring-white/10">
      <AvatarGroup aria-label="Assignees" class="[--avatar-group-overlap:0.7rem] [--avatar-group-seam:2px]" overlap="clip" role="group" size="sm">
        {assignees.map((user) => (
          <Avatar>
            <Avatar.Image alt={user.name} src={user.image} />
            <Avatar.Fallback>
              {user.name
                .split(" ")
                .map((part) => part[0])
                .join("")}
            </Avatar.Fallback>
          </Avatar>
        ))}
        <Avatar>
          <Avatar.Fallback>
            <Icon icon={User} size={16} class="size-4 shrink-0" />
          </Avatar.Fallback>
        </Avatar>
        <AvatarGroup.Count>+3</AvatarGroup.Count>
      </AvatarGroup>
      <span class="text-sm font-medium text-foreground">Assignees</span>
    </div>
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
