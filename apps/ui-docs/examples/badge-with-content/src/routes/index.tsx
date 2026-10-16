// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/badge/with-content.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Bell } from "lucide";
import { Avatar } from "@rivetjs/ui/avatar";
import { Badge } from "@rivetjs/ui/badge";
import avatarGreenImage from "../assets/avatar-green.jpg?image";

export const head = { title: "Badge: With Content" };

// #region demo
const AVATAR_URL = avatarGreenImage.src;

export function BadgeWithContent() {
  return (
    <div class="flex items-center gap-6">
      <Badge.Anchor>
        <Avatar>
          <Avatar.Image src={AVATAR_URL} />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar>
        <Badge color="danger" size="sm">
          5
        </Badge>
      </Badge.Anchor>

      <Badge.Anchor>
        <Avatar>
          <Avatar.Image src={AVATAR_URL} />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar>
        <Badge color="danger" size="sm">
          New
        </Badge>
      </Badge.Anchor>

      <Badge.Anchor>
        <Avatar>
          <Avatar.Image src={AVATAR_URL} />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar>
        <Badge color="danger" size="sm">
          99+
        </Badge>
      </Badge.Anchor>

      <Badge.Anchor>
        <Avatar>
          <Avatar.Image src={AVATAR_URL} />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar>
        <Badge color="accent" size="sm">
          <Icon icon={Bell} size={16} class="size-2.5" />
        </Badge>
      </Badge.Anchor>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <BadgeWithContent />
    </div>
  );
}
