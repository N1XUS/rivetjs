// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/popover/interactive.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Avatar } from "@rivetjs/ui/avatar";
import { Button } from "@rivetjs/ui/button";
import { Popover } from "@rivetjs/ui/popover";
import avatarPerson1Image from "../assets/avatar-person-1.jpg?image";

export const head = { title: "Popover: Interactive Content" };

// #region demo
export function PopoverInteractive() {
  const isFollowing = signal(false);

  return (
    <div class="flex items-center gap-6">
      <Popover>
        <Popover.Trigger aria-label="User profile">
          <div class="flex items-center gap-2">
            <Avatar size="sm">
              <Avatar.Image alt="Sarah Johnson" src={avatarPerson1Image.src} />
              <Avatar.Fallback>SJ</Avatar.Fallback>
            </Avatar>
            <div class="flex flex-col">
              <p class="text-sm font-medium">Sarah Johnson</p>
              <p class="text-xs text-muted">@sarahj</p>
            </div>
          </div>
        </Popover.Trigger>
        <Popover.Content class="w-[320px]">
          <Popover.Heading>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <Avatar size="md">
                  <Avatar.Image alt="Sarah Johnson" src={avatarPerson1Image.src} />
                  <Avatar.Fallback>SJ</Avatar.Fallback>
                </Avatar>
                <div>
                  <p class="font-semibold">Sarah Johnson</p>
                  <p class="text-sm text-muted">@sarahj</p>
                </div>
              </div>
              <Button class="rounded-full" size="sm" variant={isFollowing() ? "tertiary" : "primary"} onPress={() => isFollowing.set(!isFollowing())}>
                {isFollowing() ? "Following" : "Follow"}
              </Button>
            </div>
          </Popover.Heading>
          <p class="mt-3 text-sm text-muted">Product designer and creative director. Building beautiful experiences that matter.</p>
          <div class="mt-3 flex gap-4">
            <div>
              <span class="font-semibold">892</span>
              <span class="ms-1 text-sm text-muted">Following</span>
            </div>
            <div>
              <span class="font-semibold">12.5K</span>
              <span class="ms-1 text-sm text-muted">Followers</span>
            </div>
          </div>
        </Popover.Content>
      </Popover>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <PopoverInteractive />
    </div>
  );
}
