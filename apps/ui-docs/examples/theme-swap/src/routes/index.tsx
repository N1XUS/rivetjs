import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Picture } from "@rivetjs/runtime/image";
import { Avatar } from "@rivetjs/ui/avatar";
import { Button, buttonVariants } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { ChatMessage } from "@rivetjs/ui/chat-message";
import { Chip } from "@rivetjs/ui/chip";
import { Input } from "@rivetjs/ui/input";
import { InputGroup } from "@rivetjs/ui/input-group";
import { Rating } from "@rivetjs/ui/rating";
import { Segment } from "@rivetjs/ui/segment";
import { Slider } from "@rivetjs/ui/slider";
import { Switch } from "@rivetjs/ui/switch";
import { THEME_PRESETS } from "@rivetjs/ui/theme";
import { ToggleButton } from "@rivetjs/ui/toggle-button";
import { ArrowUp, Heart, Palette, Pause, Play, ShoppingBag, SkipBack, SkipForward, Sparkles } from "lucide";

import tideCover from "../assets/cover-tide.jpg?image";
import runnerImage from "../assets/shop-runner.jpg?image";

export const head = { title: "Theme swap" };

// #region demo
// The look presets shown here; every value lives in `@rivetjs/ui/theme` (THEME_PRESETS) and its generated stylesheet
// `@rivetjs/ui/styles/themes/presets.css` (one `[data-ui-preset="<id>"]` block per preset, light + dark).
const LOOKS = ["rivet", "classic", "brutalist", "glass", "mauve"] as const;
const LABELS = Object.fromEntries(THEME_PRESETS.map((p) => [p.id, p.label]));
// Theme builder links (`/themes/` query names); the Rivet preset is the builder's default.
const EDIT = Object.fromEntries(
  THEME_PRESETS.map((p) => [
    p.id,
    p.id === "rivet"
      ? "/themes/"
      : `/themes/?lightness=${p.lightness}&chroma=${p.chroma}&hue=${p.hue}&base=${p.base}&radius=${p.radius}&formRadius=${p.formRadius}`,
  ]),
);

const NOTIFY = [
  { key: "orders", label: "New orders", description: "One email per order" },
  { key: "stock", label: "Low stock", description: "When a product drops below 5" },
  { key: "digest", label: "Weekly digest", description: "Sales summary every Monday" },
];

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function ThemeSwap() {
  const preset = signal<string | null>("rivet");
  const position = signal(83);
  const playing = signal(false);
  const liked = signal(true);
  const inBag = signal(false);
  const notify = signal<Record<string, boolean>>({ orders: true, stock: true, digest: false });
  return (
    // The only binding that changes on a swap is this attribute: every card below keeps its nodes and markup.
    <section
      id="theme-swap"
      data-ui-preset={preset() ?? "rivet"}
      class="relative isolate flex flex-col gap-4 overflow-hidden bg-background p-4 text-foreground sm:p-6"
    >
      {/* Colour behind the cards for the Glass preset's frosted surfaces to blur (decoration, shown for Glass only). */}
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-(--duration-slow) [[data-ui-preset=glass]_&]:opacity-100"
      >
        <div class="absolute top-[18%] left-[8%] size-72 rounded-full bg-accent/50 blur-3xl" />
        <div class="absolute right-[10%] bottom-[8%] size-80 rounded-full bg-rivet-magenta/35 blur-3xl" />
        <div class="absolute top-[40%] left-[45%] size-56 rounded-full bg-rivet-cyan/35 blur-3xl" />
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="max-w-full overflow-x-auto">
          <Segment aria-label="Theme preset" selectedKey={preset}>
            {LOOKS.map((id) => (
              <Segment.Item id={id} data-testid={`ts-preset-${id}`}>
                {LABELS[id]}
              </Segment.Item>
            ))}
          </Segment>
        </div>
        <a id="ts-edit" href={EDIT[preset() ?? "rivet"]} target="_top" class={buttonVariants({ variant: "secondary", size: "sm" })}>
          <Icon icon={Palette} size={16} />
          Edit theme
        </a>
      </div>

      <div id="ts-cards" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <Picture image={tideCover} alt="" sizes="16rem" class="aspect-[4/3] w-full rounded-2xl object-cover" />
          <Card.Header>
            <Card.Title>Harbour Lights</Card.Title>
            <Card.Description>Marisol Vey · Low Tide Hours</Card.Description>
          </Card.Header>
          <div class="flex items-center gap-2 text-xs text-muted tabular-nums">
            <span class="w-8 text-right">{clock(position())}</span>
            <Slider aria-label="Position" value={position} minValue={0} maxValue={214} class="flex-1">
              <Slider.Track>
                <Slider.Fill />
                <Slider.Thumb />
              </Slider.Track>
            </Slider>
            <span class="w-8">3:34</span>
          </div>
          <Card.Footer class="justify-between">
            <ToggleButton isIconOnly size="sm" variant="ghost" aria-label="Like" isSelected={liked}>
              <Icon icon={Heart} size={16} />
            </ToggleButton>
            <div class="flex items-center gap-1">
              <Button isIconOnly size="sm" variant="ghost" aria-label="Previous song">
                <Icon icon={SkipBack} size={16} />
              </Button>
              <Button id="ts-play" isIconOnly aria-label={playing() ? "Pause" : "Play"} onPress={() => playing.set(!playing())}>
                <Icon icon={playing() ? Pause : Play} size={18} />
              </Button>
              <Button isIconOnly size="sm" variant="ghost" aria-label="Next song">
                <Icon icon={SkipForward} size={16} />
              </Button>
            </div>
          </Card.Footer>
        </Card>

        <Card>
          <div class="relative">
            <Picture image={runnerImage} alt="Meadow knit runner" sizes="16rem" class="aspect-[4/3] w-full rounded-2xl object-cover" />
            <Chip size="sm" class="absolute start-2 top-2">
              New
            </Chip>
          </div>
          <Card.Header>
            <Card.Title>Meadow knit runner</Card.Title>
            <div class="flex items-center gap-2 text-xs text-muted">
              <Rating value={4.7} isReadOnly size="sm" />
              <span>212 reviews</span>
            </div>
          </Card.Header>
          <Card.Footer class="mt-auto justify-between gap-3">
            <span class="text-lg font-semibold tabular-nums">$128</span>
            <Button id="ts-add" size="sm" onPress={() => inBag.set(!inBag())}>
              <Icon icon={ShoppingBag} size={16} />
              {inBag() ? "In bag" : "Add to bag"}
            </Button>
          </Card.Footer>
        </Card>

        <Card>
          <Card.Header class="flex-row items-center gap-3">
            <Avatar size="sm" color="accent" variant="soft">
              <Avatar.Fallback>
                <Icon icon={Sparkles} size={14} />
              </Avatar.Fallback>
            </Avatar>
            <div class="flex flex-col">
              <Card.Title>Shop assistant</Card.Title>
              <Card.Description>Answers from your numbers</Card.Description>
            </div>
          </Card.Header>
          <Card.Content class="gap-3">
            <ChatMessage.User>
              <ChatMessage.Bubble class="bg-accent text-accent-foreground">Which products should I discount?</ChatMessage.Bubble>
            </ChatMessage.User>
            <ChatMessage.Assistant>
              <ChatMessage.Body>
                <ChatMessage.Content>The Halo desk lamp: lowest rating and 57 reviews. Try 15 % off for a week.</ChatMessage.Content>
              </ChatMessage.Body>
            </ChatMessage.Assistant>
          </Card.Content>
          <InputGroup variant="secondary">
            <InputGroup.Input aria-label="Message" placeholder="Ask about your shop" />
            <InputGroup.Suffix>
              <Button isIconOnly size="sm" aria-label="Send">
                <Icon icon={ArrowUp} size={16} />
              </Button>
            </InputGroup.Suffix>
          </InputGroup>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Notifications</Card.Title>
            <Card.Description>What the shop emails you</Card.Description>
          </Card.Header>
          <Card.Content class="gap-1">
            {NOTIFY.map((n) => (
              <Switch isSelected={() => notify()[n.key] === true} onChange={(v: boolean) => notify.set({ ...notify(), [n.key]: v })} class="w-full py-1.5">
                <Switch.Content class="flex w-full items-center justify-between gap-4">
                  <span class="flex flex-col gap-0.5">
                    <span class="text-sm font-medium">{n.label}</span>
                    <span class="text-xs text-muted">{n.description}</span>
                  </span>
                  <Switch.Control class="shrink-0">
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            ))}
          </Card.Content>
          <Card.Footer class="gap-2">
            <Button size="sm" variant="secondary" class="flex-1">
              Cancel
            </Button>
            <Button size="sm" class="flex-1">
              Save
            </Button>
          </Card.Footer>
        </Card>
      </div>
    </section>
  );
}
// #endregion demo

export default function Page() {
  return <ThemeSwap />;
}
