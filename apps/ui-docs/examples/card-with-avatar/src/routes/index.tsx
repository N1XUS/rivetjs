// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/card/with-avatar.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Avatar } from "@rivetjs/ui/avatar";
import { Card } from "@rivetjs/ui/card";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";
import avatarRedImage from "../assets/avatar-red.jpg?image";
import cactusImage from "../assets/cactus.jpg?image";
import personYellowImage from "../assets/person-yellow.jpg?image";

export const head = { title: "Card: With Avatar" };

// #region demo
export function WithAvatar() {
  return (
    <div class="flex flex-wrap gap-4">
      <Card class="w-[200px] gap-2">
        <img
          alt="Indie Hackers community"
          class="pointer-events-none aspect-square w-14 rounded-2xl object-cover select-none"
          loading="lazy"
          src={cactusImage.src}
        />
        <Card.Header>
          <Card.Title>Indie Hackers</Card.Title>
          <Card.Description>148 members</Card.Description>
        </Card.Header>
        <Card.Footer class="flex gap-2">
          <Avatar aria-label="Martha's profile picture" class="size-5">
            <Avatar.Image alt="Martha's avatar" src={avatarRedImage.src} />
            <Avatar.Fallback class="text-xs">IH</Avatar.Fallback>
          </Avatar>
          <span class="text-xs">By Martha</span>
        </Card.Footer>
      </Card>

      <Card class="w-[200px] gap-2">
        <img
          alt="AI Builders community"
          class="pointer-events-none aspect-square w-14 rounded-2xl object-cover select-none"
          loading="lazy"
          src={personYellowImage.src}
        />
        <Card.Header>
          <Card.Title>AI Builders</Card.Title>
          <Card.Description>362 members</Card.Description>
        </Card.Header>
        <Card.Footer class="flex gap-2">
          <Avatar aria-label="John's profile picture" class="size-5">
            <Avatar.Image alt="John's avatar - blue themed" src={avatarBlueImage.src} />
            <Avatar.Fallback class="text-xs">B</Avatar.Fallback>
          </Avatar>
          <span class="text-xs">By John</span>
        </Card.Footer>
      </Card>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithAvatar />
    </div>
  );
}
