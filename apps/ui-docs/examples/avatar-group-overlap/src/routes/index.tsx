// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/avatar-group/overlap.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { Avatar } from "@rivetjs/ui/avatar";
import { AvatarGroup } from "@rivetjs/ui/avatar-group";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";
import avatarPurpleImage from "../assets/avatar-purple.jpg?image";

export const head = { title: "AvatarGroup: Overlap" };

// #region demo
// The `ag-stripes` CSS (upstream: a `<style>` element in the demo) is in src/styles.css.

function StripeBackdrop(props: { children: Content }) {
  return (
    <div class="relative inline-flex rounded-xl p-6">
      <div aria-hidden="true" class="ag-stripes pointer-events-none absolute inset-0 rounded-xl" />
      <div class="relative z-10">{props.children}</div>
    </div>
  );
}

function DemoGroup(props: { overlap: "clip" | "ring" }) {
  return (
    <AvatarGroup overlap={props.overlap} size="lg">
      <Avatar>
        <Avatar.Image alt="John" src={avatarBlueImage.src} />
        <Avatar.Fallback>JD</Avatar.Fallback>
      </Avatar>
      <Avatar>
        <Avatar.Fallback>AB</Avatar.Fallback>
      </Avatar>
      <Avatar>
        <Avatar.Image alt="Emily" src={avatarPurpleImage.src} />
        <Avatar.Fallback>EC</Avatar.Fallback>
      </Avatar>
      <Avatar>
        <Avatar.Fallback>SM</Avatar.Fallback>
      </Avatar>
      <AvatarGroup.Count>+2</AvatarGroup.Count>
    </AvatarGroup>
  );
}

export function Overlap() {
  return (
    <div class="flex flex-col items-start gap-6">
      <div class="flex flex-col gap-2">
        <p class="text-sm text-muted">clip</p>
        <StripeBackdrop>
          <DemoGroup overlap="clip" />
        </StripeBackdrop>
      </div>
      <div class="flex flex-col gap-2">
        <p class="text-sm text-muted">ring</p>
        <StripeBackdrop>
          <DemoGroup overlap="ring" />
        </StripeBackdrop>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Overlap />
    </div>
  );
}
