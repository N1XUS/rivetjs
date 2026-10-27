// Rivet-authored showcase (own content: an invented shop owner's account settings).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";
import { Alert } from "@rivetjs/ui/alert";
import { AlertDialog } from "@rivetjs/ui/alert-dialog";
import { Avatar } from "@rivetjs/ui/avatar";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Fieldset } from "@rivetjs/ui/fieldset";
import { Form } from "@rivetjs/ui/form";
import { Input } from "@rivetjs/ui/input";
import { InputGroup } from "@rivetjs/ui/input-group";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroup } from "@rivetjs/ui/item-card-group";
import { Label } from "@rivetjs/ui/label";
import { NativeSelect } from "@rivetjs/ui/native-select";
import { RadioButtonGroup } from "@rivetjs/ui/radio-button-group";
import { Segment } from "@rivetjs/ui/segment";
import { Separator } from "@rivetjs/ui/separator";
import { Switch } from "@rivetjs/ui/switch";
import { Tabs } from "@rivetjs/ui/tabs";
import { TextArea } from "@rivetjs/ui/textarea";
import { TextField } from "@rivetjs/ui/textfield";
import { KeyRound, Monitor, Moon, ShieldCheck, Sun, Upload } from "lucide";

export const head = { title: "Showcase: Settings" };

// #region demo
const NOTIFICATIONS = [
  { key: "orders", label: "New orders", description: "An email for every order, with the packing slip attached." },
  { key: "stock", label: "Low stock", description: "When a product drops below 10 units." },
  { key: "reviews", label: "Reviews", description: "When a customer leaves a review or a rating." },
  { key: "digest", label: "Product updates", description: "A short note when Fieldnote ships something new." },
];

const BIO_MAX = 160;

// The notification rows: a component of its own, so the group's children are one element (a list built inline from
// live state would make every ItemCardGroup on the site a resume candidate).
function NotificationItems(props: { notify: Signal<Record<string, boolean>> }) {
  const notify = props.notify;
  const notifyKey = (key: string) => {
    const on = signal(notify()[key]);
    return on;
  };
  return NOTIFICATIONS.map((n) => {
    const on = notifyKey(n.key);
    return (
      <ItemCard>
        <ItemCard.Content>
          <ItemCard.Title>{n.label}</ItemCard.Title>
          <ItemCard.Description class="whitespace-normal">{n.description}</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Switch id={`notify-${n.key}`} aria-label={n.label} isSelected={on} onChange={(v: boolean) => notify.set({ ...notify(), [n.key]: v })}>
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </ItemCard.Action>
      </ItemCard>
    );
  });
}

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
                <h2 class="me-auto font-semibold">Public profile</h2>
                <Button id="save-profile" type="submit">
                  Save changes
                </Button>
              </div>
              {/* A live region from the start (announced when the alert appears); hidden while empty. */}
              <div id="profile-status" role="status" class="empty:hidden">
                {saved() ? (
                  <Alert status="success">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>{saved()}</Alert.Title>
                    </Alert.Content>
                  </Alert>
                ) : null}
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
                  <Description>JPG or PNG, at least 256 × 256 px.</Description>
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
              <ItemCardGroup id="notify-email" variant="secondary" aria-labelledby="notify-email-title">
                <ItemCardGroup.Header>
                  <ItemCardGroup.Title id="notify-email-title">Email</ItemCardGroup.Title>
                  <ItemCardGroup.Description>Sent to theo@fieldnote.studio</ItemCardGroup.Description>
                </ItemCardGroup.Header>
                <NotificationItems notify={notify} />
              </ItemCardGroup>
              <Fieldset class="gap-2">
                <Fieldset.Legend class="text-sm">Order emails</Fieldset.Legend>
                <Segment id="frequency" aria-label="Order email frequency" selectedKey={frequency} size="sm" class="self-start">
                  <Segment.Item id="instant">Every order</Segment.Item>
                  <Segment.Item id="daily">Daily digest</Segment.Item>
                  <Segment.Item id="weekly">Weekly</Segment.Item>
                </Segment>
                <Description id="notify-summary">
                  {Object.values(notify()).filter(Boolean).length} of {NOTIFICATIONS.length} on
                  {frequency() === "instant"
                    ? ", orders arrive one by one."
                    : frequency() === "daily"
                      ? ", orders bundled once a day."
                      : ", orders bundled every Monday."}
                </Description>
              </Fieldset>
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
              <Fieldset class="gap-2">
                <Fieldset.Legend class="text-sm">Density</Fieldset.Legend>
                <Segment aria-label="Density" selectedKey={density} size="sm" class="self-start">
                  <Segment.Item id="compact">Compact</Segment.Item>
                  <Segment.Item id="comfortable">Comfortable</Segment.Item>
                </Segment>
              </Fieldset>
              <Description id="appearance-summary">
                Admin pages use the {theme()} theme with {density()} spacing. The storefront keeps its own look.
              </Description>
            </div>
          )}
        </Tabs.Panel>

        <Tabs.Panel id="account" class="pt-6">
          {() => (
            <div class="flex flex-col gap-6">
              <ItemCardGroup id="security" variant="secondary" aria-labelledby="security-title">
                <ItemCardGroup.Header>
                  <ItemCardGroup.Title id="security-title">Security</ItemCardGroup.Title>
                </ItemCardGroup.Header>
                <ItemCard>
                  <ItemCard.Icon>
                    <Icon icon={ShieldCheck} size={18} />
                  </ItemCard.Icon>
                  <ItemCard.Content>
                    <ItemCard.Title>Two-step sign-in</ItemCard.Title>
                    <ItemCard.Description class="whitespace-normal">
                      {twoFactor() ? "On: a code from your authenticator app at every new sign-in." : "Off: only your password protects the shop."}
                    </ItemCard.Description>
                  </ItemCard.Content>
                  <ItemCard.Action>
                    <Switch id="two-factor" aria-label="Two-step sign-in" isSelected={twoFactor}>
                      <Switch.Content>
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch.Content>
                    </Switch>
                  </ItemCard.Action>
                </ItemCard>
                <ItemCard>
                  <ItemCard.Icon>
                    <Icon icon={KeyRound} size={18} />
                  </ItemCard.Icon>
                  <ItemCard.Content>
                    <ItemCard.Title>Password</ItemCard.Title>
                    <ItemCard.Description>Last changed 4 months ago</ItemCard.Description>
                  </ItemCard.Content>
                  <ItemCard.Action>
                    <Button size="sm" variant="secondary">
                      Change password
                    </Button>
                  </ItemCard.Action>
                </ItemCard>
              </ItemCardGroup>
              <Card class="border border-danger/40">
                <Card.Header>
                  <Card.Title class="text-danger">Close the shop</Card.Title>
                  <Card.Description>Takes the storefront offline and cancels open orders. Your order history stays available for 90 days.</Card.Description>
                </Card.Header>
                <Card.Footer>
                  {closed() ? (
                    <Alert id="closed-status" role="status" status="danger" class="w-full">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>The shop is offline.</Alert.Title>
                        <Alert.Description>Reopen it from the dashboard within 90 days.</Alert.Description>
                      </Alert.Content>
                    </Alert>
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
