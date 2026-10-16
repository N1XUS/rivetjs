// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/tooltip/custom-trigger.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { CircleCheck, CircleQuestionMark } from "lucide";
import { Avatar } from "@rivetjs/ui/avatar";
import { Chip } from "@rivetjs/ui/chip";
import { Tooltip } from "@rivetjs/ui/tooltip";
import avatarPerson4Image from "../assets/avatar-person-4.jpg?image";

export const head = { title: "Tooltip: Custom Triggers" };

// #region demo
export function TooltipCustomTrigger() {
  return (
    <div class="flex items-center gap-6">
      <Tooltip delay={0}>
        <Tooltip.Trigger aria-label="User avatar">
          <Avatar size="sm">
            <Avatar.Image alt="Jane Doe" src={avatarPerson4Image.src} />
            <Avatar.Fallback>JD</Avatar.Fallback>
          </Avatar>
        </Tooltip.Trigger>
        <Tooltip.Content showArrow>
          <Tooltip.Arrow />
          <div class="flex flex-col gap-0 py-1">
            <p class="font-semibold">Jane Doe</p>
            <p class="text-xs text-muted">jane@example.com</p>
          </div>
        </Tooltip.Content>
      </Tooltip>

      <Tooltip delay={0}>
        <Tooltip.Trigger aria-label="Status chip">
          <Chip color="success">
            <Icon icon={CircleCheck} size={12} />
            <Chip.Label>Active</Chip.Label>
          </Chip>
        </Tooltip.Trigger>
        <Tooltip.Content class="flex items-center gap-1.5">
          <span class="relative flex size-2">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span class="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          <p>Jane is currently online</p>
        </Tooltip.Content>
      </Tooltip>

      <Tooltip delay={0}>
        <Tooltip.Trigger aria-label="Info icon">
          <div class="rounded-full bg-accent-soft p-2">
            <Icon icon={CircleQuestionMark} class="text-accent-soft-foreground" />
          </div>
        </Tooltip.Trigger>
        <Tooltip.Content showArrow>
          <Tooltip.Arrow />
          <div class="max-w-xs px-1 py-1.5">
            <p class="mb-1 font-semibold">Help Information</p>
            <p class="text-sm text-muted">This is a helpful tooltip with more detailed information about this feature.</p>
          </div>
        </Tooltip.Content>
      </Tooltip>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <TooltipCustomTrigger />
    </div>
  );
}
