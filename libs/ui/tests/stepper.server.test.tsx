// Server-target suite: `Stepper` SSR (Rivet addition; feature set inspired by HeroUI Pro's public Stepper docs, independent
// implementation): `ol` / `li` markup, root modifiers, index-based `data-status` + `aria-current` from `defaultStep`,
// default indicator (number / lucide check), separator progress variable, display-only `div` headers vs `button` headers
// with `onStepChange`, vertical orientation.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Stepper } from "../index.ts";
import { assertSameHtml } from "./same-html.ts";

const Fixture = (props: { defaultStep?: number; onStepChange?: (i: number) => void; orientation?: "horizontal" | "vertical"; size?: "sm" | "md" | "lg" }) => (
  <Stepper aria-label="Setup" defaultStep={props.defaultStep} onStepChange={props.onStepChange} orientation={props.orientation} size={props.size}>
    <Stepper.Step>
      <Stepper.Indicator />
      <Stepper.Content>
        <Stepper.Title>Plan</Stepper.Title>
        <Stepper.Description>Pick a plan</Stepper.Description>
      </Stepper.Content>
      <Stepper.Separator />
    </Stepper.Step>
    <Stepper.Step>
      <Stepper.Indicator />
      <Stepper.Content>
        <Stepper.Title>Pay</Stepper.Title>
      </Stepper.Content>
      <Stepper.Separator />
    </Stepper.Step>
    <Stepper.Step>
      <Stepper.Indicator />
      <Stepper.Content>
        <Stepper.Title>Done</Stepper.Title>
      </Stepper.Content>
    </Stepper.Step>
  </Stepper>
);

const statuses = (html: string) => [...html.matchAll(/<li[^>]*data-status="(\w+)"/g)].map((m) => m[1]);

test("stepper SSR: ol / li, modifiers, statuses + aria-current from defaultStep", async () => {
  const html = await renderToString(() => <Fixture defaultStep={1} />);
  assert.match(html, /<ol[^>]*data-slot="stepper"/);
  assert.match(html, /class="stepper stepper--horizontal stepper--md"/);
  assert.match(html, /aria-label="Setup"/);
  assert.deepEqual(statuses(html), ["complete", "active", "inactive"]);
  assert.equal((html.match(/aria-current="step"/g) ?? []).length, 1);
  assert.match(html, /<li[^>]*aria-current="step"[^>]*data-index="1"/);
  for (const c of [
    "stepper__step",
    "stepper__step-button",
    "stepper__indicator",
    "stepper__content",
    "stepper__title",
    "stepper__description",
    "stepper__separator",
    "stepper__separator-track",
    "stepper__separator-fill",
  ])
    assert.match(html, new RegExp(`class="${c}"`), c);
});

test("stepper SSR: default indicator = check when complete, number otherwise; separator progress", async () => {
  const html = await renderToString(() => <Fixture defaultStep={1} />);
  assert.match(html, /<svg[^>]*data-slot="stepper-check"/);
  assert.match(html, /data-status="active"[^>]*>2<\/span>/);
  assert.match(html, /data-status="inactive"[^>]*>3<\/span>/);
  const fills = [...html.matchAll(/--stepper-separator-progress: ?([\d.]+)/g)].map((m) => m[1]);
  assert.deepEqual(fills, ["1", "0"]);
});

test("stepper SSR: display only (div headers) vs onStepChange (button headers, data-clickable)", async () => {
  const still = await renderToString(() => <Fixture />);
  assert.doesNotMatch(still, /<button/);
  assert.doesNotMatch(still, /data-clickable/);
  assert.match(still, /<div[^>]*data-slot="stepper-step-button"/);
  const live = await renderToString(() => <Fixture onStepChange={() => {}} />);
  assert.equal((live.match(/<button[^>]*type="button"/g) ?? []).length, 3);
  assert.equal((live.match(/data-clickable="true"/g) ?? []).length, 3);
});

test("stepper SSR: vertical + size modifiers", async () => {
  const html = await renderToString(() => <Fixture orientation="vertical" size="sm" />);
  assert.match(html, /class="stepper stepper--vertical stepper--sm"/);
  assert.match(html, /data-orientation="vertical"/);
});

test("stepper SSR: Step shorthand (title / description) = compound step", async () => {
  await assertSameHtml(
    () => (
      <Stepper aria-label="Setup" defaultStep={1}>
        <Stepper.Step title="Plan" description="Pick a plan" />
        <Stepper.Step title="Pay" />
      </Stepper>
    ),
    () => (
      <Stepper aria-label="Setup" defaultStep={1}>
        <Stepper.Step>
          <Stepper.Indicator />
          <Stepper.Content>
            <Stepper.Title>Plan</Stepper.Title>
            <Stepper.Description>Pick a plan</Stepper.Description>
          </Stepper.Content>
          <Stepper.Separator />
        </Stepper.Step>
        <Stepper.Step>
          <Stepper.Indicator />
          <Stepper.Content>
            <Stepper.Title>Pay</Stepper.Title>
          </Stepper.Content>
          <Stepper.Separator />
        </Stepper.Step>
      </Stepper>
    ),
  );
});
