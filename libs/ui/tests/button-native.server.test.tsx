// Server-target suite: ZERO JSLEAK native `<button>` path of `Button` / `CloseButton` (`$native: 1` = the build proved the
// call site handler-less, `libs/compiler/facts-native.ts`). The native markup must equal the cdk Button markup (same
// attributes, possibly in another order, same id sequence: the resume fuzz compares resumed pages with browser renders,
// which take the cdk path). Any Button / press / focusable context, a group, a submit / reset type falls
// back to the cdk path. Path probe: the cdk Button provides `ProgressBarContext` to its children, the native one does not
// (CloseButton evaluates its children before the cdk part: its probe is the native root's attribute order instead).
import { test } from "vitest";
import assert from "node:assert/strict";
import { useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { _resetIds } from "@rivetjs/runtime/id";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ButtonContext } from "@rivetjs/cdk/button";
import { ProgressBarContext } from "../../cdk/progress-bar/context.ts";
import { Button } from "../src/components/button/index.ts";
import { ButtonGroup } from "../src/components/button-group/index.ts";
import { CloseButton } from "../src/components/close-button/index.ts";

const NATIVE = { $native: 1 } as {};

/** Renders "cdk" inside a cdk Button, "native" inside the native one. */
const Probe = () => (useContext(ProgressBarContext) ? "cdk" : "native");

/** Markup without hydration markers / boundary ids, attributes sorted per tag. */
function norm(html: string): string {
  return html
    .replace(/<!--[^>]*-->/g, "")
    .replace(/ data-b="\d+"/g, "")
    .replace(/<([a-z]+)((?:\s+[^\s=>]+(?:="[^"]*")?)*)\s*>/g, (_, tag: string, attrs: string) => {
      const list = attrs.match(/[^\s=>]+(?:="[^"]*")?/g) ?? [];
      return `<${tag}${list.length ? " " + list.sort().join(" ") : ""}>`;
    });
}

/** A render from id 0 (same id sequence for every render). */
async function render(fn: () => unknown): Promise<string> {
  _resetIds();
  return renderToString(fn as never);
}

async function same(native: () => unknown, cdk: () => unknown) {
  assert.equal(norm(await render(native)), norm(await render(cdk)));
}

test("button native: same markup as the cdk path (variants, sizes, disabled, aria / data passthrough, ids)", async () => {
  await same(
    () => (
      <Button {...NATIVE} variant="secondary" size="sm">
        Go
      </Button>
    ),
    () => (
      <Button variant="secondary" size="sm">
        Go
      </Button>
    ),
  );
  await same(
    () => (
      <Button {...NATIVE} isDisabled fullWidth class="mt-2" aria-label="Send" data-x="1">
        Send
      </Button>
    ),
    () => (
      <Button isDisabled fullWidth class="mt-2" aria-label="Send" data-x="1">
        Send
      </Button>
    ),
  );
  await same(
    () => <Button {...NATIVE} isIconOnly type="button" id="b1" radius="concentric" aria-label="More" />,
    () => <Button isIconOnly type="button" id="b1" radius="concentric" aria-label="More" />,
  );
});

test("close button native: same markup as the cdk path (default icon, custom children, label)", async () => {
  await same(
    () => <CloseButton {...NATIVE} />,
    () => <CloseButton />,
  );
  await same(
    () => (
      <CloseButton {...NATIVE} aria-label="Close banner" class="absolute">
        x
      </CloseButton>
    ),
    () => (
      <CloseButton aria-label="Close banner" class="absolute">
        x
      </CloseButton>
    ),
  );
});

test("native path: taken at a proven inert call site, refused under contexts / groups / submit / reset", async () => {
  const path = async (fn: () => unknown) => (await render(fn)).match(/cdk|native/g)?.join(",");
  assert.equal(
    await path(() => (
      <>
        <Button {...NATIVE}>
          <Probe />
        </Button>
      </>
    )),
    "native",
  );
  assert.match(await render(() => <CloseButton {...NATIVE} />), /^<button aria-label="Close" data-slot="close-button"/);
  assert.doesNotMatch(await render(() => <CloseButton />), /^<button aria-label="Close" data-slot="close-button"/);
  // No `$native` (unproven call site).
  assert.equal(
    await path(() => (
      <Button>
        <Probe />
      </Button>
    )),
    "cdk",
  );
  // ButtonGroup provides a group context (the native branch would drop its child attributes).
  assert.equal(
    await path(() => (
      <ButtonGroup>
        <Button {...NATIVE}>
          <Probe />
        </Button>
      </ButtonGroup>
    )),
    "cdk",
  );
  // A submit / reset button: its press adopts the form (constraint validation, reset).
  assert.equal(
    await path(() => (
      <>
        <Button {...NATIVE} type="submit">
          <Probe />
        </Button>
        <Button {...NATIVE} type="reset">
          <Probe />
        </Button>
      </>
    )),
    "cdk,cdk",
  );
  // A ButtonContext value (DialogTrigger / MenuTrigger slot props) must reach the button.
  const ctx = await render(() => (
    <Provider token={ButtonContext} value={{ "aria-haspopup": "dialog" } as never}>
      <Button {...NATIVE}>
        <Probe />
      </Button>
      <CloseButton {...NATIVE} />
    </Provider>
  ));
  assert.equal(ctx.match(/cdk|native/g)?.join(","), "cdk");
  assert.doesNotMatch(ctx, /<button aria-label="Close" data-slot="close-button"/);
  assert.equal((ctx.match(/aria-haspopup="dialog"/g) ?? []).length, 2);
});
