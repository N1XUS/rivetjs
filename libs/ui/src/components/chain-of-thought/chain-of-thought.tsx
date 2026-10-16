// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no reasoning trace). Feature set inspired by HeroUI Pro's public
// ChainOfThought docs (a collapsible reasoning / agent trace: `Trigger` label that shimmers while `isStreaming`,
// `Content` with `Steps` / `Step` (`label`), `defaultExpanded` / `isExpanded`); independent implementation,
// Rivet-authored styles.
// - Root = ui `Disclosure` (cdk Disclosure state: `isExpanded` / `defaultExpanded` / `onExpandedChange`, keyboard, ARIA).
// - `isStreaming` (value or accessor) only writes `data-streaming` on the root; the trigger label is a `TextShimmer` whose
//   highlight CSS shows only under `[data-streaming="true"]` (no context function, nothing runs on resume).
// - Rivet extras on `Step`: `status` ("complete" default | "active" | "pending" | "error": icon + `data-status`) and
//   `icon` (a lucide icon node replacing the status icon). Steps = `role="list"`, Step = `role="listitem"`.
import { Icon } from "@rivetjs/kit/icon";
import type { IconNode } from "@rivetjs/kit/icon";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { Brain, Circle, CircleCheck, CircleX, LoaderCircle } from "lucide";

import { chainOfThoughtVariants } from "../../../styles/src/components/chain-of-thought/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";
import { DisclosureBody, DisclosureContent, DisclosureHeading, DisclosureIndicator, DisclosureRoot, DisclosureTrigger } from "../disclosure/disclosure.tsx";
import type { DisclosureRootProps } from "../disclosure/disclosure.tsx";
import { TextShimmerRoot } from "../text-shimmer/text-shimmer.tsx";

const SLOTS = chainOfThoughtVariants();

interface ChainOfThoughtRootProps extends Omit<DisclosureRootProps, "class"> {
  /** The reasoning is still streaming: the trigger label shimmers. Value or accessor. */
  isStreaming?: boolean | (() => boolean);
  class?: string;
}

const ChainOfThoughtRoot = (props: ChainOfThoughtRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "isStreaming"]);
  const streaming = (): "true" | undefined => {
    const value = local.isStreaming;
    return (typeof value === "function" ? value() : value) === true ? "true" : undefined;
  };
  return (
    <DisclosureRoot class={composeSlotClassName(SLOTS.base, local.class)} data-chain-of-thought="" {...({ "data-streaming": streaming } as {})} {...rest}>
      {local.children}
    </DisclosureRoot>
  );
};

interface ChainOfThoughtTriggerProps {
  /** The label ("Thinking…", "Thought for 12 s"). */
  children?: Content;
  /** Lucide icon before the label. @default Brain; `null` hides it */
  icon?: IconNode | null;
  /** Heading level of the trigger's heading wrapper. @default 3 */
  level?: number;
  class?: string;
}

const ChainOfThoughtTrigger = (props: ChainOfThoughtTriggerProps): JSX.Element => {
  const [local] = splitLive(props, ["class", "children", "icon", "level"]);
  const icon = local.icon === undefined ? Brain : local.icon;
  return (
    <DisclosureHeading class={SLOTS.heading()} level={local.level ?? 3}>
      <DisclosureTrigger class={composeSlotClassName(SLOTS.trigger, local.class)} data-slot="chain-of-thought-trigger">
        {icon ? <Icon icon={icon} size={16} class={SLOTS.triggerIcon()} aria-hidden="true" /> : null}
        <TextShimmerRoot class={SLOTS.label()}>{local.children}</TextShimmerRoot>
        <DisclosureIndicator class={SLOTS.indicator()} />
      </DisclosureTrigger>
    </DisclosureHeading>
  );
};

interface ChainOfThoughtContentProps {
  children?: Content;
  class?: string;
}

const ChainOfThoughtContent = (props: ChainOfThoughtContentProps): JSX.Element => {
  const [local] = splitLive(props, ["class", "children"]);
  return (
    <DisclosureContent class={SLOTS.content()} data-slot="chain-of-thought-content">
      <DisclosureBody class={composeSlotClassName(SLOTS.body, local.class)}>{local.children}</DisclosureBody>
    </DisclosureContent>
  );
};

type DivProps = Omit<JSX.IntrinsicElements["div"], "class" | "children"> & { class?: string; children?: Content };

const ChainOfThoughtSteps = (props: DivProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <div class={composeSlotClassName(SLOTS.steps, local.class)} role="list" data-slot="chain-of-thought-steps" {...rest}>
      {local.children}
    </div>
  );
};

type ChainOfThoughtStepStatus = "complete" | "active" | "pending" | "error";

const STATUS_ICONS: Record<ChainOfThoughtStepStatus, IconNode> = { complete: CircleCheck, active: LoaderCircle, pending: Circle, error: CircleX };

interface ChainOfThoughtStepProps extends DivProps {
  /** Step title. */
  label?: Content;
  /** @default "complete" */
  status?: ChainOfThoughtStepStatus;
  /** Lucide icon replacing the status icon. */
  icon?: IconNode;
}

const ChainOfThoughtStep = (props: ChainOfThoughtStepProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "label", "status", "icon"]);
  const status = local.status ?? "complete";
  return (
    <div class={composeSlotClassName(SLOTS.step, local.class)} role="listitem" data-status={status} data-slot="chain-of-thought-step" {...rest}>
      <span class={SLOTS.stepMarker()} aria-hidden="true">
        <Icon icon={local.icon ?? STATUS_ICONS[status]} size={16} class={SLOTS.stepIcon()} />
      </span>
      <div class={SLOTS.stepBody()}>
        {local.label != null ? <div class={SLOTS.stepLabel()}>{local.label}</div> : null}
        {local.children != null ? <div class={SLOTS.stepContent()}>{local.children}</div> : null}
      </div>
    </div>
  );
};

export { ChainOfThoughtRoot, ChainOfThoughtTrigger, ChainOfThoughtContent, ChainOfThoughtSteps, ChainOfThoughtStep };
export type {
  ChainOfThoughtRootProps,
  ChainOfThoughtTriggerProps,
  ChainOfThoughtContentProps,
  DivProps as ChainOfThoughtStepsProps,
  ChainOfThoughtStepProps,
  ChainOfThoughtStepStatus,
};
