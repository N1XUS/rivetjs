import { signal } from "@rivetjs/reactivity";
import { site } from "virtual:docs/site";
import { logo } from "virtual:docs/brand";
import { sections } from "virtual:docs/nav";
import { Icon } from "@rivetjs/kit/icon";
import { Accessibility, ArrowRight, Bell, Copy, Zap } from "lucide";
import { Alert } from "@rivetjs/ui/alert";
import { Avatar } from "@rivetjs/ui/avatar";
import { Badge } from "@rivetjs/ui/badge";
import { Button } from "@rivetjs/ui/button";
import { Chip } from "@rivetjs/ui/chip";
import { Kbd } from "@rivetjs/ui/kbd";
import { Label } from "@rivetjs/ui/label";
import { Meter } from "@rivetjs/ui/meter";
import { ProgressBar } from "@rivetjs/ui/progress-bar";
import { Separator } from "@rivetjs/ui/separator";
import { Spinner } from "@rivetjs/ui/spinner";
import { Surface } from "@rivetjs/ui/surface";
import { ToggleButton } from "@rivetjs/ui/toggle-button";
import { ToggleButtonGroup } from "@rivetjs/ui/toggle-button-group";

export const head = {
  title: `${site.name} · styled, resumable components for Rivet`,
  meta: [
    { name: "description", content: site.tagline },
    { property: "og:title", content: site.name },
    { property: "og:description", content: site.tagline },
    { property: "og:type", content: "website" },
  ],
  links: [{ rel: "canonical", href: site.origin + "/" }],
};

const IDEAS = [
  {
    icon: Copy,
    title: "Compound parts, one theme",
    text: "Compound components (Card.Header, Select.Popover) with shorthand props where they save markup, BEM classes and data-slot attributes you can target, and one token-driven theme with presets.",
    href: "/start/differences/",
  },
  {
    icon: Accessibility,
    title: "Accessible by the cdk",
    text: "Press, hover, focus, keyboard and ARIA come from @rivetjs/cdk, a faithful React Aria port: the same keyboard, focus and screen reader behaviour.",
    href: "/components/overview/",
  },
  {
    icon: Zap,
    title: "Server-rendered, resumable",
    text: "Pages arrive as HTML. Markup components (Card, Chip, Alert) ship no JavaScript; a button's code loads with the page and its handler runs on the first press, without a hydration pass.",
    href: "/start/introduction/",
  },
];

const VIEWS = ["Day", "Week", "Month"] as const;

/** Home: what @rivetjs/ui is, a live showcase rendered with the real stylesheet, three ideas, the sections. */
export default function Home() {
  const progress = signal(40);
  const view = signal<string>("Week");
  const notifications = signal(3);
  return (
    <div class="home" data-pagefind-body="" data-pagefind-filter="section:Home">
      <section class="home-hero" aria-labelledby="home-title">
        <img class="home-logo" src={logo} alt="" width="84" height="80" />
        <p class="home-status">
          <span class="status-badge status-experimental">Experimental</span> Over 100 components; APIs may still change.
        </p>
        <h1 id="home-title">
          Styled components, <span class="brand-text">resumable</span>.
        </h1>
        <p class="home-tagline">{site.tagline}</p>
        <p class="home-actions">
          <a class="button-primary" href="/start/installation/" data-rivet-reload="">
            Get started
            <Icon icon={ArrowRight} size={16} />
          </a>
          <a class="button-secondary" href="/components/overview/" data-rivet-reload="">
            Components
          </a>
          <a class="button-secondary" href="/examples/" data-rivet-reload="">
            All examples
          </a>
        </p>
        {/* One look, five presets: the `theme-swap` example (variables only; the cards' HTML never changes). */}
        <div class="home-swap">
          <iframe
            src="/examples/theme-swap/frame/"
            name="example-theme-swap"
            title="Theme swap: one switch re-skins every card (live example)"
            height="480"
            data-auto-height=""
            loading="eager"
          />
        </div>
      </section>

      <section class="home-demo" aria-labelledby="home-demo-title">
        <h2 id="home-demo-title">Live, on this page</h2>
        <p>
          These are the real components with the real stylesheet, server-rendered into this page. Press, toggle and watch them update; no framework boots first.
        </p>
        <div data-ui-theme="rivet" class="ui-stage grid gap-4 rounded-3xl bg-background p-4 sm:grid-cols-2 sm:p-6">
          <Surface class="flex flex-col gap-4 rounded-2xl p-5">
            <div class="flex items-center gap-3">
              <Avatar color="accent">
                <Avatar.Fallback>AL</Avatar.Fallback>
              </Avatar>
              <div class="flex flex-col">
                <span class="text-sm font-medium">Ada Lovelace</span>
                <span class="text-xs text-muted">Analytical Engines</span>
              </div>
              <Badge.Anchor class="ml-auto">
                <Button variant="ghost" isIconOnly aria-label="Notifications" onPress={() => notifications.set(0)}>
                  <Icon icon={Bell} size={18} />
                </Button>
                <Badge color="danger" size="sm">
                  <Badge.Label>{notifications()}</Badge.Label>
                </Badge>
              </Badge.Anchor>
            </div>
            <div class="flex flex-wrap gap-2">
              <Chip color="accent" variant="soft">
                Design
              </Chip>
              <Chip color="success" variant="soft">
                Shipped
              </Chip>
              <Chip color="warning" variant="soft">
                Review
              </Chip>
              <Chip>Draft</Chip>
            </div>
            <Separator />
            <ToggleButtonGroup
              aria-label="Calendar view"
              selectionMode="single"
              disallowEmptySelection
              defaultSelectedKeys={["Week"]}
              size="sm"
              onSelectionChange={(keys: Set<unknown>) => view.set(String([...keys][0] ?? ""))}
            >
              {VIEWS.map((name) => (
                <ToggleButton id={name}>{name}</ToggleButton>
              ))}
            </ToggleButtonGroup>
            <p class="text-sm text-muted">
              Showing the <strong class="text-foreground">{view()}</strong> view.
            </p>
          </Surface>

          <Surface class="flex flex-col gap-4 rounded-2xl p-5">
            <ProgressBar value={progress()} color={progress() >= 100 ? "success" : "accent"}>
              <Label>Upload</Label>
              <ProgressBar.Output />
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
            <Meter value={72} color="warning">
              <Label>Storage</Label>
              <Meter.Output />
              <Meter.Track>
                <Meter.Fill />
              </Meter.Track>
            </Meter>
            <div class="flex flex-wrap items-center gap-2">
              <Button size="sm" onPress={() => progress.set(Math.min(100, progress() + 20))}>
                Upload more
              </Button>
              <Button size="sm" variant="secondary" onPress={() => progress.set(0)}>
                Reset
              </Button>
              <Spinner size="sm" class="ml-auto" />
            </div>
            <Alert status={progress() >= 100 ? "success" : "default"}>
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{progress() >= 100 ? "Upload complete" : "Uploading"}</Alert.Title>
                <Alert.Description>
                  Search the docs with{" "}
                  <Kbd>
                    <Kbd.Abbr keyValue="command" />
                    <Kbd.Content>K</Kbd.Content>
                  </Kbd>
                </Alert.Description>
              </Alert.Content>
            </Alert>
          </Surface>
        </div>
      </section>

      <section class="home-ideas" aria-labelledby="home-ideas-title">
        <h2 id="home-ideas-title">Why this port</h2>
        <ul class="feature-grid">
          {IDEAS.map((idea) => (
            <li>
              <a class="feature" href={idea.href} data-rivet-reload="">
                <span class="feature-icon">
                  <Icon icon={idea.icon} size={20} />
                </span>
                <strong>{idea.title}</strong>
                <span class="feature-text">{idea.text}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section class="home-sections" aria-labelledby="home-sections-title">
        <h2 id="home-sections-title">Find your way</h2>
        <ul class="card-grid">
          {sections.map((section) => (
            <li>
              <a class="card" href={section.href} data-rivet-reload="">
                <strong>{section.title}</strong>
                <p>{section.groups.map((group) => group.title).join(" · ")}</p>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
