// DOM-target suite (happy-dom): live props on the wave-1 components (docs/design/specs/2026-10-07-live-props-design.md).
// Table-driven: each case renders a client-created component with one live prop (`<X size={s()}>`), changes it twice and
// asserts the classes of the root (+ a part reading the context) follow while the elements are kept (no re-creation).
// Resumed pages: tests-components/wave1.test.ts (first change re-creates the region until live-props P3 lands).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { Provider } = await import("@rivetjs/runtime/dom");
const { FieldErrorContext } = await import("@rivetjs/cdk/form");
const { Badge, badgeVariants } = await import("../src/components/badge/index.ts");
const { Alert, alertVariants } = await import("../src/components/alert/index.ts");
const { Kbd, kbdVariants } = await import("../src/components/kbd/index.ts");
const { Spinner, spinnerVariants } = await import("../src/components/spinner/index.ts");
const { Skeleton, skeletonVariants } = await import("../src/components/skeleton/index.ts");
const { Avatar, avatarVariants } = await import("../src/components/avatar/index.ts");
const { Link, linkVariants } = await import("../src/components/link/index.ts");
const { CloseButton, closeButtonVariants } = await import("../src/components/close-button/index.ts");
const { Typography, Heading, Prose, typographyVariants } = await import("../src/components/typography/index.ts");
const { Label, labelVariants } = await import("../src/components/label/index.ts");
const { Separator, separatorVariants } = await import("../src/components/separator/index.ts");
const { Header, headerVariants } = await import("../src/components/header/index.ts");
const { Description, descriptionVariants } = await import("../src/components/description/index.ts");
const { ErrorMessage, errorMessageVariants } = await import("../src/components/error-message/index.ts");
const { FieldError, fieldErrorVariants } = await import("../src/components/field-error/index.ts");
const { EmptyState, emptyStateVariants } = await import("../src/components/empty-state/index.ts");

interface Case<V> {
  name: string;
  values: [V, V, V];
  /** Renders the component with `get()` as the live prop; ids `#a` (root) and optionally `#b` (a part). */
  view: (get: () => V) => unknown;
  /** Expected class per selector for a value. */
  expect: (v: V) => Record<string, string>;
}

const cls = (s: string | undefined): string => s ?? "";

const cases: Case<any>[] = [
  {
    name: "Badge color (root + Badge.Label)",
    values: ["default", "accent", "danger"],
    view: (get) => (
      <Badge id="a" color={get()}>
        <Badge.Label id="b">3</Badge.Label>
      </Badge>
    ),
    expect: (color) => {
      const s = badgeVariants({ color, placement: "top-right", size: "md", variant: "primary" });
      return { "#a": s.base(), "#b": s.label() };
    },
  },
  {
    name: "Badge size",
    values: ["md", "sm", "lg"],
    view: (get) => <Badge id="a" size={get()} />,
    expect: (size) => ({ "#a": badgeVariants({ color: "default", placement: "top-right", size, variant: "primary" }).base() }),
  },
  {
    name: "Alert status (root + Alert.Title)",
    values: ["default", "success", "danger"],
    view: (get) => (
      <Alert id="a" status={get()}>
        <Alert.Title id="b">T</Alert.Title>
      </Alert>
    ),
    expect: (status) => {
      const s = alertVariants({ status });
      return { "#a": s.base(), "#b": s.title() };
    },
  },
  {
    name: "Kbd variant (root + Kbd.Abbr)",
    values: ["default", "light", "default"],
    view: (get) => (
      <Kbd id="a" variant={get()}>
        <Kbd.Abbr id="b" keyValue="command" />
      </Kbd>
    ),
    expect: (variant) => {
      const s = kbdVariants({ variant });
      return { "#a": s.base(), "#b": s.abbr() };
    },
  },
  {
    name: "Spinner size",
    values: ["md", "sm", "xl"],
    view: (get) => <Spinner id="a" size={get()} />,
    expect: (size) => ({ "#a": spinnerVariants({ size }) }),
  },
  {
    name: "Skeleton animationType",
    values: ["shimmer", "pulse", "none"],
    view: (get) => <Skeleton id="a" animationType={get()} />,
    expect: (animationType) => ({ "#a": skeletonVariants({ animationType }).base() }),
  },
  {
    name: "Avatar size (root + Avatar.Fallback)",
    values: ["md", "sm", "lg"],
    view: (get) => (
      <Avatar id="a" size={get()}>
        <Avatar.Fallback id="b">AB</Avatar.Fallback>
      </Avatar>
    ),
    expect: (size) => {
      const s = avatarVariants({ color: "default", size });
      return { "#a": s.base(), "#b": s.fallback() };
    },
  },
  {
    name: "Link class",
    values: ["x", "y", "z"],
    view: (get) => (
      <Link id="a" class={get()}>
        Docs
      </Link>
    ),
    expect: (c) => ({ "#a": `${linkVariants().base()} ${c}` }),
  },
  {
    name: "CloseButton class",
    values: ["x", "y", "z"],
    view: (get) => <CloseButton id="a" class={get()} />,
    expect: (c) => ({ "#a": `${closeButtonVariants({ variant: "default" })} ${c}` }),
  },
  {
    name: "Typography color",
    values: ["default", "muted", "default"],
    view: (get) => (
      <Typography id="a" color={get()}>
        T
      </Typography>
    ),
    expect: (color) => ({ "#a": cls(typographyVariants({ align: "start", color, type: "body" }).base()) }),
  },
  {
    name: "Heading weight",
    values: ["bold", "medium", "normal"],
    view: (get) => (
      <Heading id="a" level={2} weight={get()}>
        H
      </Heading>
    ),
    expect: (weight) => ({ "#a": cls(typographyVariants({ align: "start", color: "default", type: "h2", weight }).base()) }),
  },
  {
    name: "Prose class",
    values: ["x", "y", "z"],
    view: (get) => (
      <Prose id="a" class={get()}>
        P
      </Prose>
    ),
    expect: (c) => ({ "#a": `${typographyVariants().prose()} ${c}` }),
  },
  {
    name: "Label isRequired",
    values: [false, true, false],
    view: (get) => (
      <Label id="a" isRequired={get()}>
        L
      </Label>
    ),
    expect: (isRequired) => ({ "#a": labelVariants({ isRequired }) }),
  },
  {
    name: "Separator variant",
    values: ["default", "secondary", "tertiary"],
    view: (get) => <Separator id="a" variant={get()} />,
    expect: (variant) => ({ "#a": separatorVariants({ orientation: "horizontal", variant }) }),
  },
  {
    name: "Header class",
    values: ["x", "y", "z"],
    view: (get) => (
      <Header id="a" class={get()}>
        H
      </Header>
    ),
    expect: (c) => ({ "#a": headerVariants({ class: c }) }),
  },
  {
    name: "Description class",
    values: ["x", "y", "z"],
    view: (get) => (
      <Description id="a" class={get()}>
        D
      </Description>
    ),
    expect: (c) => ({ "#a": descriptionVariants({ class: c }) }),
  },
  {
    name: "ErrorMessage class",
    values: ["x", "y", "z"],
    view: (get) => (
      <ErrorMessage id="a" class={get()}>
        E
      </ErrorMessage>
    ),
    expect: (c) => ({ "#a": errorMessageVariants({ class: c }) }),
  },
  {
    name: "FieldError class",
    values: ["x", "y", "z"],
    view: (get) => (
      <Provider token={FieldErrorContext} value={() => ({ isInvalid: true, validationErrors: ["Bad"], validationDetails: {} as never })}>
        {() => (
          <FieldError id="a" class={get()}>
            Bad
          </FieldError>
        )}
      </Provider>
    ),
    expect: (c) => ({ "#a": `${fieldErrorVariants()} ${c}` }),
  },
  {
    name: "EmptyState class",
    values: ["x", "y", "z"],
    view: (get) => <EmptyState id="a" class={get()} />,
    expect: (c) => ({ "#a": emptyStateVariants({ class: c }) }),
  },
];

for (const c of cases) {
  test(`live props (wave 1): ${c.name} updates in place`, () => {
    const v = signal(c.values[0]);
    const r = render(() => c.view(() => v()) as never);
    const selectors = Object.keys(c.expect(c.values[0]));
    const nodes = selectors.map((sel) => r.find(sel));
    for (const value of c.values) {
      v.set(value);
      const expected = c.expect(value);
      for (const [i, sel] of selectors.entries()) {
        assert.ok(nodes[i], `${sel} rendered`);
        assert.equal(r.find(sel)?.getAttribute("class"), expected[sel], `${sel} class (${String(value)})`);
        assert.ok(r.find(sel) === nodes[i], `${sel} kept (${String(value)})`);
      }
    }
    r.unmount();
  });
}

test("live props (wave 1): Alert status swaps the default indicator icon, indicator kept", () => {
  const v = signal<"default" | "success" | "danger">("default");
  const r = render(() => (
    <Alert status={v()}>
      <Alert.Indicator id="i" />
    </Alert>
  ));
  const indicator = r.find("#i");
  const icon = () => r.find("#i")?.querySelector('[data-slot="alert-default-icon"]')?.outerHTML;
  const first = icon();
  v.set("success");
  const second = icon();
  assert.notEqual(second, first);
  assert.equal(r.find("#i")?.getAttribute("class"), alertVariants({ status: "success" }).indicator());
  v.set("danger");
  assert.notEqual(icon(), second);
  assert.ok(r.find("#i") === indicator, "indicator kept");
  r.unmount();
});
