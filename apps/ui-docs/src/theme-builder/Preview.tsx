// Theme builder preview: real @rivetjs/ui components composed into mini-app tiles (theme-builder
// preview idea; invented content). The builder wraps it in `.tb-stage`, which carries the theme as inline custom
// properties (every base token + derived formula + radius). Overlays (Select, ComboBox, DatePicker, Dropdown, Popover,
// Tooltip, Modal, toasts) portal into `#tb-overlays` inside the stage (PortalProvider), so they inherit the edited theme
// instead of the docs tokens on <body>.

import { signal } from "@rivetjs/reactivity";
import { PortalProvider } from "@rivetjs/cdk/portal";
import { Icon } from "@rivetjs/kit/icon";
import { Bell, Calendar, Plus, Sparkles, Upload, Users } from "lucide";
import { Alert } from "@rivetjs/ui/alert";
import { Avatar } from "@rivetjs/ui/avatar";
import { AvatarGroup } from "@rivetjs/ui/avatar-group";
import { Badge } from "@rivetjs/ui/badge";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { Chip } from "@rivetjs/ui/chip";
import { Kbd } from "@rivetjs/ui/kbd";
import { Label } from "@rivetjs/ui/label";
import { Link } from "@rivetjs/ui/link";
import { Meter } from "@rivetjs/ui/meter";
import { ProgressBar } from "@rivetjs/ui/progress-bar";
import { ProgressCircle } from "@rivetjs/ui/progress-circle";
import { Separator } from "@rivetjs/ui/separator";
import { Skeleton } from "@rivetjs/ui/skeleton";
import { Spinner } from "@rivetjs/ui/spinner";
import { Surface } from "@rivetjs/ui/surface";
import { ToggleButton } from "@rivetjs/ui/toggle-button";
import { ToggleButtonGroup } from "@rivetjs/ui/toggle-button-group";
import { Toast, toast } from "@rivetjs/ui/toast";
import { AssistantCard, BookingCard, InvoicesCard, ProjectCard } from "./preview-data.tsx";
import { AccountCard, PlanCard, SettingsCard } from "./preview-forms.tsx";
import { COLORS, PEOPLE, TOKENS, VIEWS } from "./content.ts";

export function Preview() {
  const progress = signal(64);
  const notifications = signal(3);
  const view = signal("Week");
  return (
    <div class="tb-preview">
      <div id="tb-overlays" />
      <PortalProvider container="#tb-overlays">
        <Toast.Provider />
        <div class="tb-preview-grid">
          <Card class="tb-tile">
            <Card.Header>
              <Card.Title>Team members</Card.Title>
              <Card.Description>Invite people and pick what they can change.</Card.Description>
            </Card.Header>
            <Card.Content class="gap-3">
              {PEOPLE.map((p) => (
                <div class="flex items-center gap-3">
                  <Avatar color={p.color} size="sm">
                    <Avatar.Fallback>{p.initials}</Avatar.Fallback>
                  </Avatar>
                  <span class="flex-1 text-sm font-medium">{p.name}</span>
                  <Chip size="sm" color={p.color} variant="soft">
                    {p.role}
                  </Chip>
                </div>
              ))}
            </Card.Content>
            <Card.Footer class="gap-2">
              <Button size="sm">
                <Icon icon={Plus} size={16} />
                Invite
              </Button>
              <Button size="sm" variant="secondary">
                <Icon icon={Users} size={16} />
                Manage
              </Button>
            </Card.Footer>
          </Card>

          <Card class="tb-tile">
            <Card.Header>
              <Card.Title>Buttons</Card.Title>
              <Card.Description>Every variant, sizes and icon-only.</Card.Description>
            </Card.Header>
            <Card.Content class="gap-3">
              <div class="flex flex-wrap gap-2">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="tertiary">Tertiary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="danger-soft">Danger soft</Button>
                <Button isDisabled>Disabled</Button>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
                <Badge.Anchor>
                  <Button isIconOnly variant="tertiary" aria-label="Notifications" onPress={() => notifications.set(0)}>
                    <Icon icon={Bell} size={18} />
                  </Button>
                  <Badge color="danger" size="sm">
                    <Badge.Label>{notifications()}</Badge.Label>
                  </Badge>
                </Badge.Anchor>
              </div>
            </Card.Content>
          </Card>

          <Card class="tb-tile">
            <Card.Header>
              <Card.Title>Status</Card.Title>
              <Card.Description>Alerts in every status.</Card.Description>
            </Card.Header>
            <Card.Content class="gap-2">
              <Alert status="accent">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>New version available</Alert.Title>
                  <Alert.Description>Every color here follows your accent.</Alert.Description>
                </Alert.Content>
              </Alert>
              <Alert status="success">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Deployed</Alert.Title>
                </Alert.Content>
              </Alert>
              <Alert status="warning">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Quota at 80 %</Alert.Title>
                </Alert.Content>
              </Alert>
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Payment failed</Alert.Title>
                </Alert.Content>
              </Alert>
            </Card.Content>
            <Card.Footer class="flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onPress={() => toast.success("Theme saved", { description: "Light and dark variables are ready to export." })}
              >
                Success toast
              </Button>
              <Button size="sm" variant="tertiary" onPress={() => toast.warning("Contrast is close to the AA limit")}>
                Warning toast
              </Button>
              <Button size="sm" variant="danger-soft" onPress={() => toast.danger("Export failed")}>
                Error toast
              </Button>
            </Card.Footer>
          </Card>

          <SettingsCard />

          <Card class="tb-tile">
            <Card.Header>
              <Card.Title>Uploads</Card.Title>
              <Card.Description>Progress, meters and status.</Card.Description>
            </Card.Header>
            <Card.Content class="gap-4">
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
              <div class="flex items-center gap-3">
                {COLORS.map((color) => (
                  <ProgressCircle aria-label={`${color} progress`} color={color} value={60} size="sm">
                    <ProgressCircle.Track>
                      <ProgressCircle.TrackCircle />
                      <ProgressCircle.FillCircle />
                    </ProgressCircle.Track>
                  </ProgressCircle>
                ))}
                <Spinner size="sm" class="ml-auto" />
              </div>
            </Card.Content>
            <Card.Footer class="gap-2">
              <Button size="sm" onPress={() => progress.set(Math.min(100, progress() + 12))}>
                <Icon icon={Upload} size={16} />
                Upload more
              </Button>
              <Button size="sm" variant="tertiary" onPress={() => progress.set(0)}>
                Reset
              </Button>
            </Card.Footer>
          </Card>

          <Card class="tb-tile">
            <Card.Header>
              <Card.Title>Chips and badges</Card.Title>
              <Card.Description>Soft, primary and secondary in each color.</Card.Description>
            </Card.Header>
            <Card.Content class="gap-3">
              {(["soft", "primary", "secondary"] as const).map((variant) => (
                <div class="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <Chip color={color} variant={variant} size="sm">
                      {color}
                    </Chip>
                  ))}
                </div>
              ))}
              <div class="flex flex-wrap items-center gap-4">
                <AvatarGroup>
                  {PEOPLE.map((p) => (
                    <Avatar color={p.color} size="sm" variant="soft">
                      <Avatar.Fallback>{p.initials}</Avatar.Fallback>
                    </Avatar>
                  ))}
                </AvatarGroup>
                {COLORS.map((color) => (
                  <Badge.Anchor>
                    <Avatar size="sm" variant="soft" color={color}>
                      <Avatar.Fallback>{color.slice(0, 1).toUpperCase()}</Avatar.Fallback>
                    </Avatar>
                    <Badge color={color} size="sm">
                      <Badge.Label>8</Badge.Label>
                    </Badge>
                  </Badge.Anchor>
                ))}
              </div>
            </Card.Content>
          </Card>

          <Card class="tb-tile">
            <Card.Header>
              <Card.Title>Calendar</Card.Title>
              <Card.Description>Toggle groups, keys, links, loading.</Card.Description>
            </Card.Header>
            <Card.Content class="gap-3">
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
              <p class="flex items-center gap-2 text-sm text-muted">
                <Icon icon={Calendar} size={16} />
                Showing the <strong class="text-foreground">{view()}</strong> view. Jump with
                <Kbd>
                  <Kbd.Abbr keyValue="command" />
                  <Kbd.Content>J</Kbd.Content>
                </Kbd>
              </p>
              <Separator />
              <div class="flex flex-col gap-2">
                <Skeleton class="h-3 w-full rounded-full" />
                <Skeleton class="h-3 w-4/6 rounded-full" />
              </div>
              <Link href="#theme-css">
                Export this theme
                <Link.Icon />
              </Link>
            </Card.Content>
          </Card>

          <PlanCard />

          <ProjectCard />

          <AssistantCard />

          <InvoicesCard />

          <AccountCard />

          <BookingCard />

          <Surface class="tb-tile tb-tokens flex flex-col gap-3 rounded-3xl p-4" variant="secondary">
            <p class="flex items-center gap-2 text-sm font-medium">
              <Icon icon={Sparkles} size={16} />
              Tokens
            </p>
            <div class="grid grid-cols-5 gap-2">
              {TOKENS.map((name) => (
                <div class="flex flex-col items-center gap-1">
                  <span class="tb-token" style={{ background: `var(--${name})` }} />
                  <span class="text-[10px] text-muted">{name}</span>
                </div>
              ))}
            </div>
          </Surface>
        </div>
      </PortalProvider>
    </div>
  );
}
