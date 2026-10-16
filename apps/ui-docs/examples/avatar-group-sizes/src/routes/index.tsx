// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/avatar-group/sizes.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Avatar } from "@rivetjs/ui/avatar";
import { AvatarGroup } from "@rivetjs/ui/avatar-group";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";
import avatarGreenImage from "../assets/avatar-green.jpg?image";
import avatarOrangeImage from "../assets/avatar-orange.jpg?image";
import avatarPurpleImage from "../assets/avatar-purple.jpg?image";
import avatarRedImage from "../assets/avatar-red.jpg?image";

export const head = { title: "AvatarGroup: Sizes" };

// #region demo
const users = [
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
  {
    id: 4,
    image: avatarOrangeImage.src,
    name: "Michael Brown",
  },
  {
    id: 5,
    image: avatarRedImage.src,
    name: "Olivia Davis",
  },
];

export function Sizes() {
  return (
    <div class="flex flex-col items-center gap-6">
      <div class="flex flex-col items-center gap-2">
        <p class="text-sm text-muted">Small</p>
        <AvatarGroup size="sm">
          {users.slice(0, 4).map((user) => (
            <Avatar>
              <Avatar.Image alt={user.name} src={user.image} />
              <Avatar.Fallback>
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </Avatar.Fallback>
            </Avatar>
          ))}
        </AvatarGroup>
      </div>
      <div class="flex flex-col items-center gap-2">
        <p class="text-sm text-muted">Medium (default)</p>
        <AvatarGroup size="md">
          {users.slice(0, 4).map((user) => (
            <Avatar>
              <Avatar.Image alt={user.name} src={user.image} />
              <Avatar.Fallback>
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </Avatar.Fallback>
            </Avatar>
          ))}
        </AvatarGroup>
      </div>
      <div class="flex flex-col items-center gap-2">
        <p class="text-sm text-muted">Large</p>
        <AvatarGroup size="lg">
          {users.slice(0, 4).map((user) => (
            <Avatar>
              <Avatar.Image alt={user.name} src={user.image} />
              <Avatar.Fallback>
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </Avatar.Fallback>
            </Avatar>
          ))}
        </AvatarGroup>
      </div>
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
