// Theme builder preview, form tiles: account sign-up, notification settings, plan + billing. Real @rivetjs/ui
// components with invented content; overlays (Select / ComboBox / Tooltip / Popover / Dropdown / Modal) open in the
// preview's portal container, so they carry the edited theme too (see Preview.tsx).

import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { BellRing, CircleHelp, Copy, Ellipsis, Eye, EyeOff, Mail, Moon, Pencil, Trash2, TriangleAlert } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { Checkbox } from "@rivetjs/ui/checkbox";
import { ComboBox } from "@rivetjs/ui/combo-box";
import { Description } from "@rivetjs/ui/description";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { Input } from "@rivetjs/ui/input";
import { InputGroup } from "@rivetjs/ui/input-group";
import { Kbd } from "@rivetjs/ui/kbd";
import { Label } from "@rivetjs/ui/label";
import { Link } from "@rivetjs/ui/link";
import { ListBox } from "@rivetjs/ui/list-box";
import { Modal } from "@rivetjs/ui/modal";
import { NumberStepper } from "@rivetjs/ui/number-stepper";
import { Popover } from "@rivetjs/ui/popover";
import { RadioButtonGroup } from "@rivetjs/ui/radio-button-group";
import { Segment } from "@rivetjs/ui/segment";
import { Select } from "@rivetjs/ui/select";
import { Separator } from "@rivetjs/ui/separator";
import { Slider } from "@rivetjs/ui/slider";
import { Switch } from "@rivetjs/ui/switch";
import { TextField } from "@rivetjs/ui/textfield";
import { Tooltip } from "@rivetjs/ui/tooltip";
import { CHANNELS, PLANS, ROLES, TIMEZONES } from "./content.ts";

/** Sign-up form: TextField, InputGroup (prefix icon, password toggle), Select, ComboBox, Checkbox, button variants. */
export function AccountCard() {
  return (
    <Card class="tb-tile">
      <Card.Header>
        <Card.Title>Create your account</Card.Title>
        <Card.Description>Start a 14-day trial. No card required.</Card.Description>
      </Card.Header>
      <Card.Content class="gap-4">
        <div class="grid gap-4 @sm:grid-cols-2">
          <TextField name="first-name" variant="secondary">
            <Label>First name</Label>
            <Input placeholder="Ada" />
          </TextField>
          <TextField name="last-name" variant="secondary">
            <Label>Last name</Label>
            <Input placeholder="Lovelace" />
          </TextField>
        </div>
        <TextField name="email" type="email" variant="secondary">
          <Label>Work email</Label>
          <InputGroup variant="secondary">
            <InputGroup.Prefix>
              <Icon icon={Mail} class="size-4 text-muted" />
            </InputGroup.Prefix>
            <InputGroup.Input placeholder="ada@analytical.dev" />
          </InputGroup>
        </TextField>
        <PasswordField />
        <div class="grid gap-4 @sm:grid-cols-2">
          <TeamSelect />
          <TimezoneComboBox />
        </div>
        <Checkbox name="terms" defaultSelected variant="secondary">
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            I agree to the terms and the privacy policy
          </Checkbox.Content>
        </Checkbox>
      </Card.Content>
      <Card.Footer class="flex-col items-stretch gap-2">
        <Button fullWidth>Create account</Button>
        <Button fullWidth variant="outline">
          Continue with a passkey
        </Button>
        <p class="text-center text-sm text-muted">
          Already have an account? <Link href="#theme-css">Sign in</Link>
        </p>
      </Card.Footer>
    </Card>
  );
}

/** Password with a show / hide toggle (state local to the field). */
function PasswordField() {
  const showPassword = signal(false);
  return (
    <TextField name="password" variant="secondary">
      <Label>Password</Label>
      <InputGroup variant="secondary">
        <InputGroup.Input type={showPassword() ? "text" : "password"} placeholder="At least 12 characters" />
        <InputGroup.Suffix>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={showPassword() ? "Hide password" : "Show password"}
            onPress={() => showPassword.set(!showPassword())}
          >
            <Icon icon={showPassword() ? EyeOff : Eye} class="size-4" />
          </Button>
        </InputGroup.Suffix>
      </InputGroup>
      <Description>Use letters, numbers and a symbol.</Description>
    </TextField>
  );
}

/** Notification settings: Switch list, Segment, Slider, NumberStepper. */
export function SettingsCard() {
  return (
    <Card class="tb-tile">
      <Card.Header>
        <Card.Title class="flex items-center gap-2">
          <Icon icon={BellRing} size={18} />
          Notifications
        </Card.Title>
        <Card.Description>Choose what reaches your inbox.</Card.Description>
      </Card.Header>
      <Card.Content class="gap-4">
        {CHANNELS.map((c) => (
          <Switch defaultSelected={c.on}>
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              {c.label}
            </Switch.Content>
            <Description>{c.description}</Description>
          </Switch>
        ))}
        <Separator />
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-sm font-medium">Email frequency</span>
          <Segment aria-label="Email frequency" defaultSelectedKey="daily" size="sm">
            <Segment.Item id="instant">Instant</Segment.Item>
            <Segment.Item id="daily">Daily</Segment.Item>
            <Segment.Item id="weekly">Weekly</Segment.Item>
          </Segment>
        </div>
        <Slider defaultValue={40} class="w-full">
          <Label>Sound volume</Label>
          <Slider.Output />
          <Slider.Track>
            <Slider.Fill />
            <Slider.Thumb />
          </Slider.Track>
        </Slider>
        <QuietHours />
      </Card.Content>
    </Card>
  );
}

/** Team picker: Select + ListBox. */
function TeamSelect() {
  return (
    <Select name="team" placeholder="Pick a team" variant="secondary">
      <Label>Team</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {ROLES.map((r) => (
            <ListBox.Item id={r.id} textValue={r.label}>
              {r.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** Time zone picker: ComboBox + ListBox. */
function TimezoneComboBox() {
  return (
    <ComboBox name="timezone" variant="secondary">
      <Label>Time zone</Label>
      <ComboBox.InputGroup>
        <Input placeholder="Search cities" />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox>
          {TIMEZONES.map((t) => (
            <ListBox.Item id={t.id} textValue={t.label}>
              {t.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}

/** Quiet hours: Switch with an icon thumb enabling a NumberStepper. */
function QuietHours() {
  const quiet = signal(true);
  return (
    <div class="flex flex-wrap items-center justify-between gap-3">
      <Switch isSelected={quiet()} onChange={(on: boolean) => quiet.set(on)}>
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb>
              <Switch.Icon>
                <Icon icon={Moon} class="size-3" />
              </Switch.Icon>
            </Switch.Thumb>
          </Switch.Control>
          Quiet hours
        </Switch.Content>
      </Switch>
      <NumberStepper aria-label="Quiet hours length" defaultValue={8} minValue={1} maxValue={12} isDisabled={!quiet()} size="sm">
        <NumberStepper.Group>
          <NumberStepper.DecrementButton />
          <NumberStepper.Value />
          <NumberStepper.IncrementButton />
        </NumberStepper.Group>
      </NumberStepper>
    </div>
  );
}

/** Plan + billing: RadioButtonGroup cards, Tooltip, Popover, Dropdown, Modal (danger confirm). */
export function PlanCard() {
  const plan = signal("pro");
  return (
    <Card class="tb-tile">
      <Card.Header class="flex-row items-start justify-between gap-2">
        <div class="flex flex-col gap-1">
          <Card.Title>Plan and billing</Card.Title>
          <Card.Description>You can switch plans at any time.</Card.Description>
        </div>
        <Dropdown>
          <Button isIconOnly size="sm" variant="tertiary" aria-label="Billing actions">
            <Icon icon={Ellipsis} size={16} />
          </Button>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu>
              <Dropdown.Item id="edit" textValue="Edit billing details">
                <Icon icon={Pencil} size={16} class="size-4 shrink-0 text-muted" />
                <Label>Edit billing details</Label>
              </Dropdown.Item>
              <Dropdown.Item id="copy" textValue="Copy invoice link">
                <Icon icon={Copy} size={16} class="size-4 shrink-0 text-muted" />
                <Label>Copy invoice link</Label>
                <Kbd class="ms-auto" slot="keyboard" variant="light">
                  <Kbd.Abbr keyValue="command" />
                  <Kbd.Content>C</Kbd.Content>
                </Kbd>
              </Dropdown.Item>
              <Dropdown.Item id="delete" textValue="Delete workspace" variant="danger">
                <Icon icon={Trash2} size={16} class="size-4 shrink-0 text-danger" />
                <Label>Delete workspace</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </Card.Header>
      <Card.Content class="gap-4">
        <RadioButtonGroup aria-label="Plan" class="flex-col" value={plan()} onChange={(value: string) => plan.set(value)}>
          {PLANS.map((p) => (
            <RadioButtonGroup.Item value={p.id}>
              <RadioButtonGroup.Indicator />
              <RadioButtonGroup.ItemIcon>
                <Icon icon={p.icon} />
              </RadioButtonGroup.ItemIcon>
              <RadioButtonGroup.ItemContent>
                <Label>{p.label}</Label>
                <Description>{p.description}</Description>
              </RadioButtonGroup.ItemContent>
              <span class="ms-auto text-sm font-semibold tabular-nums">{p.price}</span>
            </RadioButtonGroup.Item>
          ))}
        </RadioButtonGroup>
        <div class="flex items-center gap-2 text-sm text-muted">
          Seats included: 5
          <Tooltip delay={0}>
            <Button isIconOnly size="sm" variant="ghost" aria-label="About seats">
              <Icon icon={CircleHelp} size={16} />
            </Button>
            <Tooltip.Content showArrow>
              <Tooltip.Arrow />
              <p>Extra seats cost $8 a month each.</p>
            </Tooltip.Content>
          </Tooltip>
        </div>
      </Card.Content>
      <Card.Footer class="flex-wrap gap-2">
        <Popover>
          <Button size="sm" variant="secondary">
            Compare plans
          </Button>
          <Popover.Content class="max-w-64">
            <Popover.Heading>{plan() === "enterprise" ? "Enterprise" : plan() === "pro" ? "Pro" : "Starter"}</Popover.Heading>
            <p class="mt-2 text-sm text-muted">
              {plan() === "starter"
                ? "3 projects, community support."
                : plan() === "pro"
                  ? "Unlimited projects, 5 seats, priority support."
                  : "SSO, audit log, 99.9 % SLA."}
            </p>
          </Popover.Content>
        </Popover>
        <Modal>
          <Button size="sm" variant="danger-soft">
            Cancel subscription
          </Button>
          <Modal.Content class="sm:max-w-[380px]">
            <Modal.Header>
              <Modal.Icon class="bg-danger-soft text-danger-soft-foreground">
                <Icon icon={TriangleAlert} class="size-5" />
              </Modal.Icon>
              <Modal.Heading>Cancel subscription?</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p>Your workspace stays on the current plan until the end of the billing period, then moves to Starter.</p>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="tertiary">
                Keep plan
              </Button>
              <Button slot="close" variant="danger">
                Cancel subscription
              </Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal>
      </Card.Footer>
    </Card>
  );
}
