// Rivet-authored showcase (own content: an invented shop owner's account settings).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { AlertDialog } from "@rivetjs/ui/alert-dialog";
import { Avatar } from "@rivetjs/ui/avatar";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Form } from "@rivetjs/ui/form";
import { Input } from "@rivetjs/ui/input";
import { InputGroup } from "@rivetjs/ui/input-group";
import { Label } from "@rivetjs/ui/label";
import { NativeSelect } from "@rivetjs/ui/native-select";
import { RadioButtonGroup } from "@rivetjs/ui/radio-button-group";
import { Segment } from "@rivetjs/ui/segment";
import { Separator } from "@rivetjs/ui/separator";
import { Switch } from "@rivetjs/ui/switch";
import { Tabs } from "@rivetjs/ui/tabs";
import { TextArea } from "@rivetjs/ui/textarea";
import { TextField } from "@rivetjs/ui/textfield";
import { CircleCheck, Monitor, Moon, Sun, Upload } from "lucide";

export const head = { title: "Showcase: Settings" };

// #region demo
const NOTIFICATIONS = [
  { key: "orders", label: "New orders", description: "An email for every order, with the packing slip attached." },
  { key: "stock", label: "Low stock", description: "When a product drops below 10 units." },
  { key: "reviews", label: "Reviews", description: "When a customer leaves a review or a rating." },
  { key: "digest", label: "Product updates", description: "A short note when Fieldnote ships something new." },
];

const BIO_MAX = 160;

export default function SettingsShowcase() {
  const name = signal("Theo Varga");
  const handle = signal("fieldnote");
  const bio = signal("Small-batch goods for walking, reading and slow mornings. Shipped from Rotterdam.");
  const timezone = signal("Europe/Amsterdam");
  const saved = signal("");
  const notify = signal<Record<string, boolean>>({ orders: true, stock: true, reviews: false, digest: false });
  const frequency = signal<string | null>("instant");
  const theme = signal<string | null>("system");
  const density = signal<string | null>("comfortable");
  const twoFactor = signal(true);
  const closed = signal(false);

  const notifyKey = (key: string) => {
    const on = signal(notify()[key]);
    return on;
  };

  return (
    <div class="mx-auto flex max-w-3xl flex-col gap-6 p-4 text-sm sm:p-8">
      <header class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold">Settings</h1>
        <p class="text-muted">Manage your shop profile, notifications and account.</p>
      </header>

      <Tabs aria-label="Settings sections" class="w-full">
        <Tabs.List aria-label="Settings sections">
          <Tabs.Tab id="profile">Profile</Tabs.Tab>
          <Tabs.Tab id="notifications">Notifications</Tabs.Tab>
          <Tabs.Tab id="appearance">Appearance</Tabs.Tab>
          <Tabs.Tab id="account">Account</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel id="profile" class="pt-6">
          {() => (
            <Form
              id="profile-form"
              class="flex flex-col gap-6"
              onSubmit={(event: SubmitEvent) => {
                event.preventDefault();
                saved.set(`Saved at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`);
              }}
            >
              <div class="flex flex-wrap items-center gap-3">
                <div class="min-w-0 flex-1">
                  <h2 class="font-semibold">Public profile</h2>
                  <p id="profile-status" role="status" class="flex items-center gap-1 text-xs text-success empty:hidden">
                    {saved() ? <Icon icon={CircleCheck} size={12} /> : null}
                    {saved()}
                  </p>
                </div>
                <Button id="save-profile" type="submit">
                  Save changes
                </Button>
              </div>
              <Separator />
              <div class="flex items-center gap-4">
                <Avatar size="lg" color="accent">
                  <Avatar.Fallback>TV</Avatar.Fallback>
                </Avatar>
                <div class="flex flex-col gap-1">
                  <Button size="sm" variant="secondary" class="self-start">
                    <Icon icon={Upload} size={14} />
                    Upload photo
                  </Button>
                  <p class="text-xs text-muted">JPG or PNG, at least 256 × 256 px.</p>
                </div>
              </div>
              <div class="grid gap-4 sm:grid-cols-2">
                <TextField id="profile-name" isRequired name="name" value={name} fullWidth>
                  <Label>Display name</Label>
                  <Input variant="secondary" />
                  <FieldError />
                </TextField>
                <TextField
                  id="profile-handle"
                  isRequired
                  name="handle"
                  value={handle}
                  validate={(v: string) => (/^[a-z0-9-]{3,24}$/.test(v) ? null : "3 to 24 lowercase letters, digits or dashes.")}
                  fullWidth
                >
                  <Label>Shop address</Label>
                  <InputGroup variant="secondary" fullWidth>
                    <InputGroup.Prefix>fieldnote.shop/</InputGroup.Prefix>
                    <InputGroup.Input />
                  </InputGroup>
                  <FieldError />
                </TextField>
              </div>
              <TextField
                id="profile-bio"
                name="bio"
                value={bio}
                fullWidth
                validate={(v: string) => (v.length > BIO_MAX ? `Keep it under ${BIO_MAX} characters.` : null)}
              >
                <Label>About the shop</Label>
                <TextArea rows={3} variant="secondary" />
                <Description>
                  Shown on your storefront. {bio().length} / {BIO_MAX}
                </Description>
                <FieldError />
              </TextField>
              <NativeSelect value={timezone} variant="secondary" class="sm:max-w-xs" fullWidth>
                <Label>Time zone</Label>
                <NativeSelect.Trigger>
                  <NativeSelect.Option value="Europe/Lisbon">Lisbon (UTC+1)</NativeSelect.Option>
                  <NativeSelect.Option value="Europe/Amsterdam">Amsterdam (UTC+2)</NativeSelect.Option>
                  <NativeSelect.Option value="Europe/Helsinki">Helsinki (UTC+3)</NativeSelect.Option>
                  <NativeSelect.Option value="America/New_York">New York (UTC−4)</NativeSelect.Option>
                </NativeSelect.Trigger>
              </NativeSelect>
            </Form>
          )}
        </Tabs.Panel>

        <Tabs.Panel id="notifications" class="pt-6">
          {() => (
            <div class="flex flex-col gap-6">
              <Card variant="secondary">
                <Card.Header>
                  <Card.Title>Email</Card.Title>
                  <Card.Description>Sent to theo@fieldnote.studio</Card.Description>
                </Card.Header>
                <Card.Content class="flex flex-col gap-1">
                  {NOTIFICATIONS.map((n) => {
                    const on = notifyKey(n.key);
                    return (
                      <Switch id={`notify-${n.key}`} isSelected={on} onChange={(v: boolean) => notify.set({ ...notify(), [n.key]: v })} class="w-full py-2">
                        <Switch.Content class="flex w-full items-center justify-between gap-4">
                          <span class="flex flex-col gap-0.5">
                            <span class="font-medium">{n.label}</span>
                            <span class="text-xs text-muted">{n.description}</span>
                          </span>
                          <Switch.Control class="shrink-0">
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch.Content>
                      </Switch>
                    );
                  })}
                </Card.Content>
              </Card>
              <div class="flex flex-col gap-2">
                <p class="font-medium">Order emails</p>
                <Segment id="frequency" aria-label="Order email frequency" selectedKey={frequency} size="sm" class="self-start">
                  <Segment.Item id="instant">Every order</Segment.Item>
                  <Segment.Item id="daily">Daily digest</Segment.Item>
                  <Segment.Item id="weekly">Weekly</Segment.Item>
                </Segment>
                <p id="notify-summary" class="text-xs text-muted">
                  {Object.values(notify()).filter(Boolean).length} of {NOTIFICATIONS.length} on
                  {frequency() === "instant"
                    ? ", orders arrive one by one."
                    : frequency() === "daily"
                      ? ", orders bundled once a day."
                      : ", orders bundled every Monday."}
                </p>
              </div>
            </div>
          )}
        </Tabs.Panel>

        <Tabs.Panel id="appearance" class="pt-6">
          {() => (
            <div class="flex flex-col gap-6">
              <RadioButtonGroup id="theme" value={theme} layout="grid" class="w-full">
                <Label>Theme</Label>
                <RadioButtonGroup.Item value="light">
                  <RadioButtonGroup.Indicator />
                  <RadioButtonGroup.ItemIcon>
                    <Icon icon={Sun} />
                  </RadioButtonGroup.ItemIcon>
                  <RadioButtonGroup.ItemContent>
                    <Label>Light</Label>
                    <Description>Bright surfaces</Description>
                  </RadioButtonGroup.ItemContent>
                </RadioButtonGroup.Item>
                <RadioButtonGroup.Item value="dark">
                  <RadioButtonGroup.Indicator />
                  <RadioButtonGroup.ItemIcon>
                    <Icon icon={Moon} />
                  </RadioButtonGroup.ItemIcon>
                  <RadioButtonGroup.ItemContent>
                    <Label>Dark</Label>
                    <Description>Easy on the eyes at night</Description>
                  </RadioButtonGroup.ItemContent>
                </RadioButtonGroup.Item>
                <RadioButtonGroup.Item value="system">
                  <RadioButtonGroup.Indicator />
                  <RadioButtonGroup.ItemIcon>
                    <Icon icon={Monitor} />
                  </RadioButtonGroup.ItemIcon>
                  <RadioButtonGroup.ItemContent>
                    <Label>System</Label>
                    <Description>Follows your device</Description>
                  </RadioButtonGroup.ItemContent>
                </RadioButtonGroup.Item>
              </RadioButtonGroup>
              <div class="flex flex-col gap-2">
                <p class="font-medium">Density</p>
                <Segment aria-label="Density" selectedKey={density} size="sm" class="self-start">
                  <Segment.Item id="compact">Compact</Segment.Item>
                  <Segment.Item id="comfortable">Comfortable</Segment.Item>
                </Segment>
              </div>
              <p id="appearance-summary" class="text-xs text-muted">
                Admin pages use the {theme()} theme with {density()} spacing. The storefront keeps its own look.
              </p>
            </div>
          )}
        </Tabs.Panel>

        <Tabs.Panel id="account" class="pt-6">
          {() => (
            <div class="flex flex-col gap-6">
              <Card variant="secondary">
                <Card.Header>
                  <Card.Title>Security</Card.Title>
                </Card.Header>
                <Card.Content class="flex flex-col gap-4">
                  <Switch id="two-factor" isSelected={twoFactor} class="w-full">
                    <Switch.Content class="flex w-full items-center justify-between gap-4">
                      <span class="flex flex-col gap-0.5">
                        <span class="font-medium">Two-step sign-in</span>
                        <span class="text-xs text-muted">
                          {twoFactor() ? "On: a code from your authenticator app at every new sign-in." : "Off: only your password protects the shop."}
                        </span>
                      </span>
                      <Switch.Control class="shrink-0">
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch.Content>
                  </Switch>
                  <Separator />
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <span class="flex flex-col gap-0.5">
                      <span class="font-medium">Password</span>
                      <span class="text-xs text-muted">Last changed 4 months ago</span>
                    </span>
                    <Button size="sm" variant="secondary">
                      Change password
                    </Button>
                  </div>
                </Card.Content>
              </Card>
              <Card class="border border-danger/40">
                <Card.Header>
                  <Card.Title class="text-danger">Close the shop</Card.Title>
                  <Card.Description>Takes the storefront offline and cancels open orders. Your order history stays available for 90 days.</Card.Description>
                </Card.Header>
                <Card.Footer>
                  {closed() ? (
                    <p id="closed-status" role="status" class="text-danger">
                      The shop is offline. Reopen it from the dashboard within 90 days.
                    </p>
                  ) : (
                    <AlertDialog>
                      <Button id="close-shop" variant="danger">
                        Close shop
                      </Button>
                      <AlertDialog.Backdrop>
                        <AlertDialog.Container>
                          <AlertDialog.Dialog class="sm:max-w-[400px]">
                            <AlertDialog.CloseTrigger />
                            <AlertDialog.Header>
                              <AlertDialog.Icon status="danger" />
                              <AlertDialog.Heading>Close Fieldnote?</AlertDialog.Heading>
                            </AlertDialog.Header>
                            <AlertDialog.Body>
                              <p>Customers will see a closed notice and 3 open orders will be refunded.</p>
                            </AlertDialog.Body>
                            <AlertDialog.Footer>
                              <Button slot="close" variant="tertiary">
                                Keep it open
                              </Button>
                              <Button id="confirm-close" slot="close" variant="danger" onPress={() => closed.set(true)}>
                                Close shop
                              </Button>
                            </AlertDialog.Footer>
                          </AlertDialog.Dialog>
                        </AlertDialog.Container>
                      </AlertDialog.Backdrop>
                    </AlertDialog>
                  )}
                </Card.Footer>
              </Card>
            </div>
          )}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
// #endregion
