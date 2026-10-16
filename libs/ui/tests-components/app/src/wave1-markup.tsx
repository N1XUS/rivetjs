// Plan 2 wave 1 T10–T13 (pure-markup) components in one fragment, shared by the `/wave1` (with Button / Link / CloseButton / Avatar) and
// `/wave1-markup` (markup only: "no JS before interaction" gate) story routes; `FieldMarkup` = the cdk `TextField` with FieldError (`/wave1` only).
import { signal } from "@rivetjs/reactivity";
import { TextField } from "@rivetjs/cdk/text-field";
import { Alert } from "@rivetjs/ui/alert";
import { Badge } from "@rivetjs/ui/badge";
import { Chip } from "@rivetjs/ui/chip";
import { Description } from "@rivetjs/ui/description";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { ErrorMessage } from "@rivetjs/ui/error-message";
import { FieldError } from "@rivetjs/ui/field-error";
import { Header } from "@rivetjs/ui/header";
import { Kbd } from "@rivetjs/ui/kbd";
import { Label } from "@rivetjs/ui/label";
import { Separator } from "@rivetjs/ui/separator";
import { Skeleton } from "@rivetjs/ui/skeleton";
import { Spinner } from "@rivetjs/ui/spinner";
import { Typography } from "@rivetjs/ui/typography";

/** T10–T13 components (pure markup, no cdk state): rendered by the server in `#w-static` + `#w-markup`, then again by the client inside
 * the keyed `#w-markup` region after the first press. Each root carries a `w-<name>` class the test compares per component. */
export function Markup(props: { n: number }) {
  return (
    <>
      <Header class="w-header">Wave 1</Header>
      <Separator class="w-separator" />
      <Typography.Heading level={2} class="w-heading">
        Heading
      </Typography.Heading>
      <Typography.Paragraph size="sm" class="w-paragraph">
        Paragraph
      </Typography.Paragraph>
      <Typography.Code class="w-code">code</Typography.Code>
      <Typography.Prose class="w-prose">prose</Typography.Prose>
      <Label isRequired class="w-label">
        Email
      </Label>
      <Description class="w-description">We never share it</Description>
      <ErrorMessage class="w-error-message">Standalone error</ErrorMessage>
      <Kbd variant="default" class="w-kbd">
        <Kbd.Abbr keyValue="command" />
        <Kbd.Content>K</Kbd.Content>
      </Kbd>
      <Spinner size="sm" class="w-spinner" />
      <Skeleton class="w-skeleton h-4 w-20" />
      <EmptyState class="w-empty-state" />
      <Chip color="danger" class="w-chip">
        Chip
      </Chip>
      <Badge.Anchor class="w-badge">
        <Badge color="accent" size="sm">
          9
        </Badge>
        <span>anchor</span>
      </Badge.Anchor>
      <Alert status="success" class="w-alert">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Done</Alert.Title>
          <Alert.Description>It worked</Alert.Description>
        </Alert.Content>
      </Alert>
      <output class="w-n">{props.n}</output>
    </>
  );
}

/** `FieldError` needs a cdk field: Label / Description / FieldError inside a cdk `TextField` (which preloads its state chunks on load,
 * so this fragment stays off the markup-only route). */
export function FieldMarkup() {
  return (
    <TextField isInvalid name="email" class="w-field">
      <Label isRequired class="w-field-label">
        Email
      </Label>
      <Description class="w-field-description">We never share it</Description>
      <FieldError class="w-field-error">Enter a valid email</FieldError>
    </TextField>
  );
}

/** Expression children + live props (`/wave1` only: reactive bindings resume, so not on the no-JS `/wave1-markup` page): Chip / Badge
 * wrap a text-valued `{expr}` child in their `*Label` on both lowerings (server markup == client markup, `wave1.test.ts`). */
export function ExprMarkup() {
  const saved = signal(false);
  return (
    <div>
      <Chip class="w-chip-expr" color={saved() ? "success" : "default"} variant="soft" size="sm">
        {saved() ? "Saved" : "Draft"}
      </Chip>
      <Badge.Anchor class="w-badge-expr">
        <Badge size="sm" color={saved() ? "success" : "accent"}>
          {saved() ? "+" : "1"}
        </Badge>
        <span>anchor</span>
      </Badge.Anchor>
    </div>
  );
}
