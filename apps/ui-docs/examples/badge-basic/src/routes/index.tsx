// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/badge/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Avatar } from "@rivetjs/ui/avatar";
import { Badge } from "@rivetjs/ui/badge";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";
import avatarGreenImage from "../assets/avatar-green.jpg?image";
import avatarOrangeImage from "../assets/avatar-orange.jpg?image";

export const head = { title: "Badge: Usage" };

// #region demo
const GREEN_AVATAR_URL = avatarGreenImage.src;
const ORANGE_AVATAR_URL = avatarOrangeImage.src;
const BLUE_AVATAR_URL = avatarBlueImage.src;

export function BadgeBasic() {
  return (
    <div class="flex items-center gap-6">
      <Badge.Anchor>
        <Avatar>
          <Avatar.Image src={GREEN_AVATAR_URL} />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar>
        <Badge color="danger" size="sm">
          5
        </Badge>
      </Badge.Anchor>

      <Badge.Anchor>
        <Avatar>
          <Avatar.Image src={ORANGE_AVATAR_URL} />
          <Avatar.Fallback>AB</Avatar.Fallback>
        </Avatar>
        <Badge color="accent" size="sm">
          New
        </Badge>
      </Badge.Anchor>

      <Badge.Anchor>
        <Avatar>
          <Avatar.Image src={BLUE_AVATAR_URL} />
          <Avatar.Fallback>CD</Avatar.Fallback>
        </Avatar>
        <Badge color="success" placement="bottom-right" size="sm" />
      </Badge.Anchor>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <BadgeBasic />
    </div>
  );
}
