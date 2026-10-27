// Rivet-authored showcase (own content: an invented shop's sign-in; nothing is sent anywhere).
import { Icon } from "@rivetjs/kit/icon";
import { computed, signal } from "@rivetjs/reactivity";
import { Alert } from "@rivetjs/ui/alert";
import { Button } from "@rivetjs/ui/button";
import { Checkbox } from "@rivetjs/ui/checkbox";
import { Description } from "@rivetjs/ui/description";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { FieldError } from "@rivetjs/ui/field-error";
import { Form } from "@rivetjs/ui/form";
import { Input } from "@rivetjs/ui/input";
import { InputGroup } from "@rivetjs/ui/input-group";
import { InputOTP } from "@rivetjs/ui/input-otp";
import { Label } from "@rivetjs/ui/label";
import { Link } from "@rivetjs/ui/link";
import { Meter } from "@rivetjs/ui/meter";
import { Segment } from "@rivetjs/ui/segment";
import { Separator } from "@rivetjs/ui/separator";
import { TextField } from "@rivetjs/ui/textfield";
import { ArrowLeft, CircleCheck, Eye, EyeOff, KeyRound, Mail, Store } from "lucide";
import { AuroraCanvas } from "../components/aurora-canvas.tsx";

export const head = { title: "Showcase: Sign in" };

// #region demo
type Step = "form" | "reset" | "reset-sent" | "code" | "done";

/** 0…4: length, digits, mixed case, symbols. */
const strength = (password: string) =>
  [password.length >= 10, /\d/.test(password), /[a-z]/.test(password) && /[A-Z]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
const STRENGTH = ["Too weak", "Weak", "Fair", "Good", "Strong"];

export default function AuthShowcase() {
  const mode = signal<string | null>("signin");
  const step = signal<Step>("form");
  const email = signal("");
  const password = signal("");
  const name = signal("");
  const visible = signal(false);
  const terms = signal(false);
  const code = signal("");
  const codeError = signal("");
  const passwordType = computed(() => (visible() ? "text" : "password"));

  const signUp = () => mode() === "signup";
  const score = () => strength(password());
  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    code.set("");
    codeError.set("");
    step.set("code");
  };
  const passwordField = (id: string, isNew: boolean) => (
    <TextField
      id={id}
      isRequired
      name="password"
      value={password}
      type={passwordType()}
      autoComplete={isNew ? "new-password" : "current-password"}
      validate={(v: string) => (isNew && strength(v) < 2 ? "Use at least 10 characters with a digit or a symbol." : null)}
      fullWidth
    >
      <Label>Password</Label>
      <InputGroup variant="secondary" fullWidth>
        <InputGroup.Input />
        <InputGroup.Suffix>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={visible() ? "Hide password" : "Show password"}
            onPress={() => visible.update((_visible) => !_visible)}
          >
            <Icon icon={visible() ? EyeOff : Eye} size={16} />
          </Button>
        </InputGroup.Suffix>
      </InputGroup>
      <FieldError />
    </TextField>
  );

  return (
    <div class="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel (from 1024 px): CSS gradient on the server, drifting canvas blobs once visible (no image). */}
      <aside class="aurora relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <AuroraCanvas />
        <div class="relative flex items-center gap-2 font-semibold">
          <Icon icon={Store} size={20} />
          Fieldnote
        </div>
        <blockquote class="relative flex max-w-md flex-col gap-3">
          <p class="text-2xl leading-snug font-medium text-balance">
            “We moved the whole shop over in a weekend. Orders, stock and the newsletter now live in one place.”
          </p>
          <footer class="text-sm opacity-80">Ilse Marchetti, Harbourlight</footer>
        </blockquote>
      </aside>

      <main class="flex items-center justify-center p-4 sm:p-10">
        <div class="flex w-full max-w-sm flex-col gap-6">
          <div class="flex items-center gap-2 font-semibold lg:hidden">
            <Icon icon={Store} size={20} />
            Fieldnote
          </div>

          {/* One step at a time: the server renders the form step, the others are created in the browser. */}
          {step() === "form" ? (
            <section class="flex flex-col gap-6">
              <div class="flex flex-col gap-1">
                <h1 id="auth-title" class="text-2xl font-semibold">
                  {signUp() ? "Create your shop" : "Welcome back"}
                </h1>
                <p class="text-sm text-muted">{signUp() ? "Start selling in a few minutes. No card needed." : "Sign in to manage orders and stock."}</p>
              </div>
              <Segment id="auth-mode" aria-label="Account" selectedKey={mode} class="w-full">
                <Segment.Item id="signin" class="flex-1">
                  Sign in
                </Segment.Item>
                <Segment.Item id="signup" class="flex-1">
                  Create account
                </Segment.Item>
              </Segment>

              {/* Two forms, one shown (ui Form reads `class` once, so a wrapper toggles it): each keeps its own autocomplete hints and rules. */}
              <div class={signUp() ? "hidden" : "contents"}>
                <Form id="signin-form" class="flex flex-col gap-4" onSubmit={submit}>
                  <TextField id="signin-email" isRequired type="email" name="email" value={email} autoComplete="email" fullWidth>
                    <Label>Email</Label>
                    <Input placeholder="you@example.com" variant="secondary" />
                    <FieldError />
                  </TextField>
                  {passwordField("signin-password", false)}
                  <Link id="forgot" class="-mt-2 self-end text-xs" onPress={() => step.set("reset")}>
                    Forgot password?
                  </Link>
                  <Button id="signin-submit" type="submit" fullWidth>
                    Sign in
                  </Button>
                </Form>
              </div>

              <div class={signUp() ? "contents" : "hidden"}>
                <Form id="signup-form" class="flex flex-col gap-4" onSubmit={submit}>
                  <TextField id="signup-name" isRequired name="name" value={name} autoComplete="name" fullWidth>
                    <Label>Your name</Label>
                    <Input variant="secondary" />
                    <FieldError />
                  </TextField>
                  <TextField id="signup-email" isRequired type="email" name="email" value={email} autoComplete="email" fullWidth>
                    <Label>Email</Label>
                    <Input placeholder="you@example.com" variant="secondary" />
                    <FieldError />
                  </TextField>
                  {passwordField("signup-password", true)}
                  <Meter
                    id="strength"
                    aria-label="Password strength"
                    value={score() * 25}
                    valueLabel={STRENGTH[score()]}
                    color={score() >= 3 ? "success" : score() === 2 ? "warning" : "danger"}
                    size="sm"
                  >
                    <div class="flex justify-between text-xs">
                      <Label class="text-muted">Strength</Label>
                      <Meter.Output />
                    </div>
                    <Meter.Track>
                      <Meter.Fill />
                    </Meter.Track>
                  </Meter>
                  <Checkbox id="signup-terms" isSelected={terms}>
                    <Checkbox.Content class="text-sm">
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      I agree to the terms and the privacy notice
                    </Checkbox.Content>
                  </Checkbox>
                  <Button id="signup-submit" type="submit" fullWidth isDisabled={() => !terms()}>
                    Create account
                  </Button>
                </Form>
              </div>

              <Separator id="auth-or">or</Separator>
              <div class="flex flex-col gap-2">
                <Button variant="secondary" fullWidth onPress={() => step.set("code")}>
                  <Icon icon={KeyRound} size={16} />
                  Continue with a passkey
                </Button>
                <Button variant="tertiary" fullWidth onPress={() => step.set("reset")}>
                  <Icon icon={Mail} size={16} />
                  Email me a sign-in link
                </Button>
              </div>
            </section>
          ) : null}

          {step() === "reset" || step() === "reset-sent" ? (
            <div class="flex flex-col gap-5">
              <Button variant="ghost" size="sm" class="self-start" onPress={() => step.set("form")}>
                <Icon icon={ArrowLeft} size={16} />
                Back
              </Button>
              <div class="flex flex-col gap-1">
                <h1 class="text-2xl font-semibold">Reset your password</h1>
                <p class="text-sm text-muted">We send a link that is valid for 30 minutes.</p>
              </div>
              {step() === "reset-sent" ? (
                <Alert id="reset-status" role="status" status="success">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>Check your inbox</Alert.Title>
                    <Alert.Description>If {email()} has an account, the link is on its way.</Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : (
                <Form
                  class="flex flex-col gap-4"
                  onSubmit={(event: SubmitEvent) => {
                    event.preventDefault();
                    step.set("reset-sent");
                  }}
                >
                  <TextField id="reset-email" isRequired type="email" name="email" value={email} fullWidth>
                    <Label>Email</Label>
                    <Input placeholder="you@example.com" variant="secondary" />
                    <FieldError />
                  </TextField>
                  <Button id="reset-submit" type="submit" fullWidth>
                    Send link
                  </Button>
                </Form>
              )}
            </div>
          ) : null}

          {step() === "code" ? (
            <div class="flex flex-col gap-5">
              <div class="flex flex-col gap-1">
                <h1 class="text-2xl font-semibold">Check your inbox</h1>
                <p class="text-sm text-muted">Enter the 6-digit code we sent to {email() || "your email"}. In this demo, the code is 204318.</p>
              </div>
              <div class="flex flex-col gap-2">
                <Label>Sign-in code</Label>
                <InputOTP
                  maxLength={6}
                  value={code}
                  isInvalid={!!codeError()}
                  onComplete={(value: string) => {
                    if (value === "204318") step.set("done");
                    else codeError.set("That code does not match. Check the latest email.");
                  }}
                >
                  <InputOTP.Group>
                    <InputOTP.Slot index={0} />
                    <InputOTP.Slot index={1} />
                    <InputOTP.Slot index={2} />
                  </InputOTP.Group>
                  <InputOTP.Separator />
                  <InputOTP.Group>
                    <InputOTP.Slot index={3} />
                    <InputOTP.Slot index={4} />
                    <InputOTP.Slot index={5} />
                  </InputOTP.Group>
                </InputOTP>
                <Description id="code-hint" class={codeError() ? "text-danger" : ""}>
                  {codeError() || "The code expires in 10 minutes."}
                </Description>
              </div>
              <Button variant="ghost" size="sm" class="self-start" onPress={() => step.set("form")}>
                <Icon icon={ArrowLeft} size={16} />
                Use another account
              </Button>
            </div>
          ) : null}

          {step() === "done" ? (
            <EmptyState id="auth-done" size="lg">
              <EmptyState.Header>
                <EmptyState.Media variant="icon" class="bg-success-soft text-success-soft-foreground">
                  <Icon icon={CircleCheck} size={24} />
                </EmptyState.Media>
                {/* The step's page heading (the other steps have an h1). */}
                <EmptyState.Title aria-level={1} class="text-2xl font-semibold">
                  {signUp() ? `Welcome, ${name() || "new seller"}` : "You are signed in"}
                </EmptyState.Title>
                <EmptyState.Description>Taking you to the dashboard…</EmptyState.Description>
              </EmptyState.Header>
              <EmptyState.Content>
                <Button variant="secondary" onPress={() => step.set("form")}>
                  Start over
                </Button>
              </EmptyState.Content>
            </EmptyState>
          ) : null}
        </div>
      </main>
    </div>
  );
}
// #endregion
