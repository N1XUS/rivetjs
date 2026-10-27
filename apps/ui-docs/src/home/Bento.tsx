// The "Components" showcase: a dense collage of live @rivetjs/ui components in three columns (one on phones), each
// tile its own component, so a first press loads only that tile's code. Static tiles (no handler, no signal) ship no
// JavaScript; avatars are plain ui avatar markup (the Avatar component probes its image in an effect at load).
import { signal } from "@rivetjs/reactivity";
import { parseDate } from "@rivetjs/cdk/date";
import { Icon } from "@rivetjs/kit/icon";
import { Picture } from "@rivetjs/runtime/image";
import { BadgeCheck, Bell, CalendarDays, Globe, Info, KeyRound, Mail, Paperclip, Save, UserRound } from "lucide";
import { avatarVariants } from "@rivetjs/ui/avatar";
import { Button } from "@rivetjs/ui/button";
import { Calendar } from "@rivetjs/ui/calendar";
import { Card } from "@rivetjs/ui/card";
import { AreaChart, Sparkline } from "@rivetjs/ui/chart";
import { Checkbox } from "@rivetjs/ui/checkbox";
import { Chip } from "@rivetjs/ui/chip";
import { CloseButton } from "@rivetjs/ui/close-button";
import { DateField } from "@rivetjs/ui/date-field";
import { DatePicker } from "@rivetjs/ui/date-picker";
import { Description } from "@rivetjs/ui/description";
import { Input } from "@rivetjs/ui/input";
import { inputOTPVariants } from "@rivetjs/ui/input-otp";
import { Kpi } from "@rivetjs/ui/kpi";
import { Label } from "@rivetjs/ui/label";
import { Link } from "@rivetjs/ui/link";
import { ListBox } from "@rivetjs/ui/list-box";
import { ProgressCircle } from "@rivetjs/ui/progress-circle";
import { PromptInput } from "@rivetjs/ui/prompt-input";
import { Radio } from "@rivetjs/ui/radio";
import { RadioGroup } from "@rivetjs/ui/radio-group";
import { Rating } from "@rivetjs/ui/rating";
import { Segment } from "@rivetjs/ui/segment";
import { Select } from "@rivetjs/ui/select";
import { Separator } from "@rivetjs/ui/separator";
import { Slider } from "@rivetjs/ui/slider";
import { Spinner } from "@rivetjs/ui/spinner";
import { Switch } from "@rivetjs/ui/switch";
import { TextField } from "@rivetjs/ui/textfield";

import avatarBlue from "../../examples/_assets/avatar-blue.jpg?image";
import avatarGreen from "../../examples/_assets/avatar-green.jpg?image";
import avatarOrange from "../../examples/_assets/avatar-orange.jpg?image";
import avatarPurple from "../../examples/_assets/avatar-purple.jpg?image";
import avatarRed from "../../examples/_assets/avatar-red.jpg?image";
import cactus from "../../examples/_assets/cactus.jpg?image";
import personYellow from "../../examples/_assets/person-yellow.jpg?image";
import avatarBlack from "../../examples/_assets/avatar-black.jpg?image";

type ImageOf = typeof cactus;

const AVATAR_SM = avatarVariants({ size: "sm" });
const AVATAR_MD = avatarVariants({ size: "md" });
const OTP = inputOTPVariants();
const CODE = ["4", "3", "2", "0", "", ""];
const AVATAR_LG = avatarVariants({ size: "lg" });

/** A ui avatar as markup: `avatar` + `avatar__image` classes around a responsive picture. */
function Face(props: { image: ImageOf; alt: string; size?: "sm" | "md" | "lg"; class?: string }) {
  const slots = props.size === "sm" ? AVATAR_SM : props.size === "lg" ? AVATAR_LG : AVATAR_MD;
  return (
    <span class={slots.base({ class: props.class })}>
      <Picture image={props.image} alt={props.alt} sizes="48px" class={slots.image()} as="img" />
    </span>
  );
}

const STATES = ["California", "New York", "Texas", "Washington", "Florida"];
const VISITS = [
  { month: "Jan", visits: 3200, signups: 1400 },
  { month: "Feb", visits: 4100, signups: 1620 },
  { month: "Mar", visits: 3800, signups: 1910 },
  { month: "Apr", visits: 5200, signups: 2050 },
  { month: "May", visits: 6100, signups: 2380 },
  { month: "Jun", visits: 5800, signups: 2610 },
];
const WEEK = [
  { day: "Mon", value: 32 },
  { day: "Tue", value: 41 },
  { day: "Wed", value: 38 },
  { day: "Thu", value: 52 },
  { day: "Fri", value: 47 },
  { day: "Sat", value: 61 },
  { day: "Sun", value: 58 },
];

/** Email field, state select, the small controls row, price slider, range segment. */
function FormTile() {
  return (
    <div class="uih-tile uih-bare flex flex-col gap-6" data-tile="form">
      <TextField name="email" type="email" defaultValue="ada@rivet.dev">
        <Label>Email</Label>
        <Input />
        <Description>We never share your email.</Description>
      </TextField>
      <Select placeholder="Select one" isRequired>
        <Label>State</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {STATES.map((state) => (
              <ListBox.Item id={state} textValue={state}>
                {state}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <Checkbox aria-label="Remember me" defaultSelected>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
        </Checkbox>
        <Switch aria-label="Sync" defaultSelected>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>
        <RadioGroup aria-label="Plan" defaultValue="pro" orientation="horizontal" name="home-plan" class="flex-row gap-3">
          <Radio value="free" aria-label="Free">
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
          </Radio>
          <Radio value="pro" aria-label="Pro">
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
          </Radio>
        </RadioGroup>
        <Spinner size="sm" aria-label="Loading" />
        <ProgressCircle aria-label="Upload" value={68} size="sm">
          <ProgressCircle.Track>
            <ProgressCircle.TrackCircle />
            <ProgressCircle.FillCircle />
          </ProgressCircle.Track>
        </ProgressCircle>
      </div>
      <Slider defaultValue={250} minValue={0} maxValue={500} formatOptions={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}>
        <Label>Price</Label>
        <Slider.Output />
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
      <Segment aria-label="Range" defaultSelectedKey="1d" class="w-full">
        <Segment.Item id="1d">1D</Segment.Item>
        <Segment.Item id="7d">7D</Segment.Item>
        <Segment.Item id="1m">1M</Segment.Item>
        <Segment.Item id="1y">1Y</Segment.Item>
        <Segment.Item id="all">All</Segment.Item>
      </Segment>
    </div>
  );
}

/** KPI with an inline sparkline (static). */
function KpiTile() {
  return (
    <Kpi class="uih-tile" data-tile="kpi">
      <Kpi.Header>
        <Kpi.Title>Weekly orders</Kpi.Title>
      </Kpi.Header>
      <div class="flex items-end justify-between gap-4">
        <Kpi.Content class="flex-col items-start">
          <Kpi.Value value={329} />
          <Kpi.Trend trend="up">12%</Kpi.Trend>
        </Kpi.Content>
        <div class="h-12 w-32">
          <Sparkline data={WEEK} index="day" series={[{ key: "value", label: "Orders" }]} height={48} aria-label="Orders this week" />
        </div>
      </div>
    </Kpi>
  );
}

/** Stacked avatars + verification code entry. */
function VerifyTile() {
  return (
    <div class="uih-tile uih-bare flex flex-col items-start gap-6" data-tile="verify">
      <div class="uih-stack" aria-label="Team: Ada, Grace, Alan, Linus and 3 more" role="img">
        <Face image={avatarBlue} alt="" />
        <Face image={avatarGreen} alt="" />
        <Face image={avatarPurple} alt="" />
        <Face image={avatarOrange} alt="" />
        <Face image={avatarRed} alt="" />
        <span class={AVATAR_MD.base({ class: "uih-stack-more" })}>
          <span class={AVATAR_MD.fallback()}>+3</span>
        </span>
      </div>
      <div class="flex flex-col gap-2">
        <div class="flex flex-col gap-1">
          <p class="text-sm font-medium">Verify account</p>
          <p class="text-sm text-muted">We sent a code to a****@rivet.dev</p>
        </div>
        {/* Static slots with the InputOTP classes: the InputOTP component's mirrors / caret / ResizeObserver run in load-time
            effects, which would start the runtime (and this page's whole boundary chain) before any input. */}
        <div class={OTP.base()} role="img" aria-label="Verification code: 4 3 2 0, two digits to go">
          {[CODE.slice(0, 3), CODE.slice(3)].map((group, g) => [
            g ? <div class={OTP.separator()} /> : null,
            <div class={OTP.group()}>
              {group.map((digit) => (
                <div class={OTP.slot()} data-filled={digit ? "true" : undefined}>
                  {digit ? <div class={OTP.slotValue()}>{digit}</div> : null}
                </div>
              ))}
            </div>,
          ])}
        </div>
        <p class="text-sm text-muted">
          No code yet?{" "}
          <Link href="#home-collage" class="font-medium text-foreground">
            Resend
          </Link>
        </p>
      </div>
    </div>
  );
}

/** Every button variant (static: no handler). */
function ButtonsTile() {
  return (
    <div class="uih-tile uih-bare grid grid-cols-3 gap-3" data-tile="buttons">
      <Button size="sm" fullWidth>
        Primary
      </Button>
      <Button size="sm" fullWidth variant="secondary">
        Secondary
      </Button>
      <Button size="sm" fullWidth variant="tertiary">
        Tertiary
      </Button>
      <Button size="sm" fullWidth variant="danger">
        Danger
      </Button>
      <Button size="sm" fullWidth variant="danger-soft">
        Soft
      </Button>
      <Button size="sm" fullWidth variant="ghost">
        Ghost
      </Button>
    </div>
  );
}

/** Profile card with a follow toggle that updates the follower count. */
function ProfileTile() {
  const following = signal(false);
  return (
    <Card class="uih-tile" data-tile="profile">
      <div class="flex items-start gap-3">
        <Face image={avatarBlack} alt="" />
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="flex items-center gap-1 text-sm font-semibold">
            Rivet Labs
            <Icon icon={BadgeCheck} size={16} class="text-accent" aria-label="Verified" />
          </span>
          <span class="text-xs text-muted">@rivetjs</span>
        </div>
        <Button
          size="sm"
          variant={following() ? "tertiary" : "primary"}
          aria-pressed={following()}
          id="home-follow"
          onPress={() => following.set(!following())}
        >
          {following() ? "Following" : "Follow"}
        </Button>
      </div>
      <p class="text-sm">Compiled JSX that resumes in the browser. Shipping a component library one release at a time.</p>
      <p class="flex gap-4 text-sm text-muted">
        <span>
          <strong class="font-semibold text-foreground">12</strong> Following
        </span>
        <span>
          <strong class="font-semibold text-foreground" id="home-followers">
            {following() ? "4,211" : "4,210"}
          </strong>{" "}
          Followers
        </span>
      </p>
    </Card>
  );
}

/** Credits notice + notifications switch. */
function CreditsTile() {
  return (
    <div class="flex flex-col gap-4" data-tile="credits">
      <Card class="uih-tile flex-row items-center gap-3 py-3">
        <Icon icon={Info} size={18} class="shrink-0 text-muted" />
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="text-sm font-medium">2 build credits left</span>
          <span class="text-xs text-muted">Upgrade for unlimited preview builds</span>
        </div>
        <Button size="sm" variant="secondary">
          Upgrade
        </Button>
      </Card>
      <div class="uih-tile uih-bare">
        <Switch defaultSelected class="w-full">
          <Switch.Content class="w-full justify-between">
            <span class="flex flex-col">
              <span class="text-sm font-medium">Allow notifications</span>
              <Description>Push updates when a build finishes</Description>
            </span>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </div>
    </div>
  );
}

/** Sign-up card: icon, title, primary action, two alternatives. */
function SignUpTile() {
  return (
    <Card class="uih-tile items-center text-center" data-tile="signup">
      <CloseButton aria-label="Close" class="absolute end-3 top-3" />
      <span class={AVATAR_MD.base()}>
        <span class={AVATAR_MD.fallback()}>
          <Icon icon={UserRound} size={18} />
        </span>
      </span>
      <Card.Header class="items-center">
        <Card.Title>Create an account</Card.Title>
        <Card.Description>Free for 14 days. No card needed.</Card.Description>
      </Card.Header>
      <Card.Footer class="w-full flex-col gap-3">
        <Button fullWidth>Get started</Button>
        <div class="flex w-full items-center gap-3 text-xs text-muted">
          <Separator class="flex-1" />
          or
          <Separator class="flex-1" />
        </div>
        <Button fullWidth variant="tertiary">
          <Icon icon={Mail} size={16} />
          Continue with email
        </Button>
        <Button fullWidth variant="tertiary">
          <Icon icon={KeyRound} size={16} />
          Continue with a passkey
        </Button>
      </Card.Footer>
    </Card>
  );
}

/** Two community cards with pictures. */
function CommunityTile() {
  const groups = [
    { image: cactus, title: "Indie makers", members: "148 members", by: "Ada", face: avatarRed },
    { image: personYellow, title: "AI builders", members: "362 members", by: "Linus", face: avatarBlue },
  ];
  return (
    <div class="grid grid-cols-2 gap-4" data-tile="community">
      {groups.map((group) => (
        <Card class="uih-tile gap-2">
          <Picture image={group.image} alt="" sizes="56px" class="aspect-square w-14 rounded-2xl object-cover" as="img" />
          <Card.Header>
            <Card.Title>{group.title}</Card.Title>
            <Card.Description>{group.members}</Card.Description>
          </Card.Header>
          <Card.Footer class="gap-2">
            <Face image={group.face} alt="" size="sm" class="size-5" />
            <span class="text-xs text-muted">By {group.by}</span>
          </Card.Footer>
        </Card>
      ))}
    </div>
  );
}

/** Confirmation dialog look-alike: the choice shows in the card. */
function UnsavedTile() {
  const choice = signal<"open" | "saved" | "discarded">("open");
  return (
    <Card class="uih-tile" data-tile="unsaved">
      <span class="grid size-10 place-items-center rounded-full bg-warning-soft text-warning-soft-foreground">
        <Icon icon={Save} size={18} />
      </span>
      <Card.Header>
        <Card.Title>{choice() === "saved" ? "Changes saved" : choice() === "discarded" ? "Changes discarded" : "Unsaved changes"}</Card.Title>
        <Card.Description>{choice() === "open" ? "Save your edits before leaving this page?" : "Nothing left to save."}</Card.Description>
      </Card.Header>
      <Card.Footer class="grid grid-cols-2 gap-3">
        <Button fullWidth variant="tertiary" isDisabled={choice() !== "open"} onPress={() => choice.set("discarded")}>
          Discard
        </Button>
        <Button fullWidth id="home-save" isDisabled={choice() !== "open"} onPress={() => choice.set("saved")}>
          Save changes
        </Button>
      </Card.Footer>
    </Card>
  );
}

/** Area chart card (static SVG). */
function ChartTile() {
  return (
    <Card class="uih-tile" data-tile="chart">
      <Card.Header class="flex-row items-start justify-between">
        <div class="flex flex-col gap-1">
          <Card.Title>Visitors</Card.Title>
          <Card.Description>January to June</Card.Description>
        </div>
        <Chip size="sm" color="success" variant="soft">
          +18%
        </Chip>
      </Card.Header>
      <AreaChart
        data={VISITS}
        index="month"
        height={120}
        showYAxis={false}
        series={[
          { key: "visits", label: "Visits" },
          { key: "signups", label: "Sign-ups" },
        ]}
        aria-label="Visits and sign-ups by month"
      />
    </Card>
  );
}

/** Date picker with its popover calendar (fixed date: no today-dependent markup). */
function ScheduleTile() {
  return (
    <Card class="uih-tile" data-tile="schedule">
      <Card.Header class="flex-row items-center gap-2">
        <Icon icon={CalendarDays} size={18} class="text-muted" />
        <Card.Title>Book a demo</Card.Title>
      </Card.Header>
      <DatePicker name="demo-date" defaultValue={parseDate("2026-11-12")} class="w-full">
        <Label>Date</Label>
        <DateField.Group fullWidth>
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
          <DateField.Suffix>
            <DatePicker.Trigger>
              <DatePicker.TriggerIndicator />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <DatePicker.Popover>
          <Calendar aria-label="Demo date">
            <Calendar.Header>
              <Calendar.Heading />
              <Calendar.NavButton slot="previous" />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
              <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
            </Calendar.Grid>
          </Calendar>
        </DatePicker.Popover>
      </DatePicker>
    </Card>
  );
}

/** Prompt input: sending shows the message above the box. */
function PromptTile() {
  const sent = signal("");
  return (
    <div class="uih-tile uih-bare flex flex-col gap-3" data-tile="prompt">
      {sent() ? (
        <p class="self-end rounded-2xl bg-accent px-3 py-2 text-sm text-accent-foreground" id="home-sent">
          {sent()}
        </p>
      ) : null}
      <PromptInput onSubmit={(value) => sent.set(value)}>
        <PromptInput.Shell>
          <PromptInput.Content>
            <PromptInput.TextArea id="home-prompt" placeholder="Ask the docs anything…" aria-label="Message" />
          </PromptInput.Content>
          <PromptInput.Toolbar>
            <PromptInput.ToolbarStart>
              <PromptInput.Action aria-label="Attach a file">
                <Icon icon={Paperclip} size={16} />
              </PromptInput.Action>
              <PromptInput.Action aria-label="Search the web">
                <Icon icon={Globe} size={16} />
              </PromptInput.Action>
            </PromptInput.ToolbarStart>
            <PromptInput.ToolbarEnd>
              <PromptInput.Send />
            </PromptInput.ToolbarEnd>
          </PromptInput.Toolbar>
        </PromptInput.Shell>
      </PromptInput>
    </div>
  );
}

/** Review card: rating stars + the chosen score. */
function ReviewTile() {
  const stars = signal(4);
  return (
    <Card class="uih-tile gap-3" data-tile="review">
      <Card.Header>
        <Card.Title id="home-review-title">How was the release?</Card.Title>
        <Card.Description>
          You rated it{" "}
          <strong class="font-semibold text-foreground" id="home-stars">
            {stars()}
          </strong>{" "}
          out of 5
        </Card.Description>
      </Card.Header>
      <Rating value={stars} aria-labelledby="home-review-title" name="home-review" />
    </Card>
  );
}

/** Notification list (static). */
function InboxTile() {
  const items = [
    { face: avatarGreen, who: "Grace", what: "approved your pull request", when: "2m" },
    { face: avatarPurple, who: "Alan", what: "commented on Release notes", when: "1h" },
  ];
  return (
    <Card class="uih-tile gap-3" data-tile="inbox">
      <Card.Header class="flex-row items-center justify-between">
        <Card.Title class="flex items-center gap-2">
          <Icon icon={Bell} size={16} />
          Notifications
        </Card.Title>
        <Chip size="sm" color="accent" variant="soft">
          2 new
        </Chip>
      </Card.Header>
      <ul class="flex flex-col gap-3">
        {items.map((item) => (
          <li class="flex items-center gap-3">
            <Face image={item.face} alt="" size="sm" />
            <span class="min-w-0 flex-1 text-sm">
              <strong class="font-medium">{item.who}</strong> <span class="text-muted">{item.what}</span>
            </span>
            <span class="text-xs text-muted">{item.when}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** The collage: three columns on wide screens, two on tablets, one on phones (secondary tiles hidden there). */
export function Bento() {
  return (
    <div class="uih-bento">
      <div class="uih-col">
        <FormTile />
        <KpiTile />
        <div class="max-md:hidden">
          <InboxTile />
        </div>
        <div class="max-xl:hidden">
          <ChartTile />
        </div>
      </div>
      <div class="uih-col">
        <VerifyTile />
        <ButtonsTile />
        <ProfileTile />
        <CreditsTile />
        <div class="max-md:hidden">
          <PromptTile />
        </div>
      </div>
      <div class="uih-col">
        <SignUpTile />
        <div class="max-md:hidden">
          <CommunityTile />
        </div>
        <UnsavedTile />
        <ReviewTile />
        <ScheduleTile />
      </div>
    </div>
  );
}
