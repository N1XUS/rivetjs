// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/avatar-group/grid.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Avatar } from "@rivetjs/ui/avatar";
import { AvatarGroup } from "@rivetjs/ui/avatar-group";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";
import avatarGreenImage from "../assets/avatar-green.jpg?image";
import avatarOrangeImage from "../assets/avatar-orange.jpg?image";
import avatarPurpleImage from "../assets/avatar-purple.jpg?image";
import avatarRedImage from "../assets/avatar-red.jpg?image";

export const head = { title: "AvatarGroup: Grid" };

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

export function Grid() {
  return (
    <AvatarGroup isGrid max={5}>
      {users.map((user) => (
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
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Grid />
    </div>
  );
}
