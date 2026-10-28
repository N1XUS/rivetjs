// Themes section: one switch swaps the whole look of the cards below (colours, radii, borders, shadows, backdrop) by
// changing `data-ui-preset` on their scope (presets.ts links the preset styles on the first press); markup never changes. As in the showcase, the switch writes the attribute of
// its sibling scope (`#home-looks`), so a press wakes the switch only.
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { ArrowUp, Check, Palette, Sparkles } from "lucide";
import { Button, buttonVariants } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { ChatMessage } from "@rivetjs/ui/chat-message";
import { Chip } from "@rivetjs/ui/chip";
import { InputGroup } from "@rivetjs/ui/input-group";
import { Segment } from "@rivetjs/ui/segment";
import { Switch } from "@rivetjs/ui/switch";
import { LOOKS } from "./data.ts";
import { applyPreset } from "./presets.ts";

/** Look switch + theme builder link for the current look. */
export function LookBar() {
  const look = signal<string | null>("rivet");
  const edit = () => LOOKS.find((l) => l.id === look())?.edit ?? "/themes/";
  return (
    <div class="uih-looks-bar">
      <div class="uih-scroll-x">
        <Segment
          aria-label="Theme preset"
          selectedKey={look}
          onSelectionChange={(key: unknown) => {
            if (key) void applyPreset("home-looks", String(key));
          }}
        >
          {LOOKS.map((l) => (
            <Segment.Item id={l.id}>{l.label}</Segment.Item>
          ))}
        </Segment>
      </div>
      <a id="home-edit-theme" class={buttonVariants({ variant: "tertiary", size: "sm" })} href={edit()} data-rivet-reload="">
        <Icon icon={Palette} size={16} />
        Edit in the theme builder
      </a>
    </div>
  );
}

const FEATURES = ["Unlimited projects", "Preview deploys", "Theme export"];
const SETTINGS = [
  { label: "Build alerts", description: "When a deploy fails", on: true },
  { label: "Weekly digest", description: "Every Monday", on: false },
  { label: "Mentions", description: "Comments and reviews", on: true },
];

function PlanCard() {
  return (
    <Card class="gap-4">
      <Card.Header>
        <div class="flex items-center justify-between">
          <Card.Title>Team</Card.Title>
          <Chip size="sm" color="accent" variant="soft">
            Popular
          </Chip>
        </div>
        <Card.Description>For studios shipping every week</Card.Description>
      </Card.Header>
      <p class="flex items-baseline gap-1">
        <span class="text-3xl font-semibold tracking-tight">$24</span>
        <span class="text-sm text-muted">per seat / month</span>
      </p>
      <ul class="flex flex-col gap-2 text-sm">
        {FEATURES.map((f) => (
          <li class="flex items-center gap-2">
            <Icon icon={Check} size={16} class="text-accent" />
            {f}
          </li>
        ))}
      </ul>
      <Card.Footer>
        <Button fullWidth>Start a trial</Button>
      </Card.Footer>
    </Card>
  );
}

function SettingsCard() {
  return (
    <Card>
      <Card.Header>
        <Card.Title>Notifications</Card.Title>
        <Card.Description>What we email you</Card.Description>
      </Card.Header>
      <Card.Content class="gap-1">
        {SETTINGS.map((s) => (
          <Switch defaultSelected={s.on} class="w-full py-1.5">
            <Switch.Content class="flex w-full items-center justify-between gap-4">
              <span class="flex flex-col gap-0.5">
                <span class="text-sm font-medium">{s.label}</span>
                <span class="text-xs text-muted">{s.description}</span>
              </span>
              <Switch.Control class="shrink-0">
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        ))}
      </Card.Content>
    </Card>
  );
}

function AssistantCard() {
  return (
    <Card>
      <Card.Header class="flex-row items-center gap-3">
        <span class="grid size-8 place-items-center rounded-full bg-accent-soft text-accent-soft-foreground">
          <Icon icon={Sparkles} size={14} />
        </span>
        <div class="flex flex-col">
          <Card.Title>Assistant</Card.Title>
          <Card.Description>Answers from your docs</Card.Description>
        </div>
      </Card.Header>
      <Card.Content class="gap-3">
        <ChatMessage.User>
          <ChatMessage.Bubble class="bg-accent text-accent-foreground">How do I add a dark theme?</ChatMessage.Bubble>
        </ChatMessage.User>
        <ChatMessage.Assistant>
          <ChatMessage.Body>
            <ChatMessage.Content>Every token already has a dark value: set data-theme="dark" on any ancestor.</ChatMessage.Content>
          </ChatMessage.Body>
        </ChatMessage.Assistant>
      </Card.Content>
      <InputGroup variant="secondary">
        <InputGroup.Input aria-label="Message" placeholder="Ask a question" />
        <InputGroup.Suffix>
          {/* Concentric square from the input group (TW-169: shell height − 2 × inset, ≥ the WCAG 2.2 24 px target). */}
          <Button isIconOnly size="sm" aria-label="Send">
            <Icon icon={ArrowUp} size={16} />
          </Button>
        </InputGroup.Suffix>
      </InputGroup>
    </Card>
  );
}

/** The themed cards (+ colour blobs behind them for the Glass look's frosted surfaces). */
export function LookPreview() {
  return (
    <div id="home-looks" class="uih-looks uih-stage" data-ui-theme="rivet" data-testid="home-looks">
      <div aria-hidden="true" class="uih-looks-glow">
        <span class="uih-blob uih-blob-a" />
        <span class="uih-blob uih-blob-b" />
        <span class="uih-blob uih-blob-c" />
      </div>
      <div class="uih-looks-grid">
        <PlanCard />
        <SettingsCard />
        <AssistantCard />
      </div>
    </div>
  );
}
