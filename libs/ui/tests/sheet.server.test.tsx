// Server-target suite: `Sheet` SSR (Rivet-authored; feature set inspired by HeroUI Pro's public Sheet docs) — closed: only the
// trigger; defaultOpen: the cdk overlay renders the sheet in the server HTML (resumable) with classes, data-slots and data
// attributes; snap points: the first-render `transform` expression + backdrop `--sheet-backdrop-opacity` (no measurement).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Sheet } from "../src/components/sheet/index.ts";

type Snap = number | string;

const SheetFixture = (props: {
  defaultOpen?: boolean;
  placement?: "top" | "bottom" | "left" | "right";
  snapPoints?: Snap[];
  fadeFromIndex?: number;
  isDetached?: boolean;
}) => (
  <Sheet
    defaultOpen={props.defaultOpen}
    placement={props.placement}
    snapPoints={props.snapPoints}
    fadeFromIndex={props.fadeFromIndex}
    isDetached={props.isDetached}
  >
    <Sheet.Trigger>Open sheet</Sheet.Trigger>
    <Sheet.Backdrop>
      <Sheet.Content>
        <Sheet.Dialog>
          <Sheet.Handle />
          <Sheet.Header>
            <Sheet.Heading>Sheet title</Sheet.Heading>
          </Sheet.Header>
          <Sheet.Body>
            <p>Sheet body</p>
          </Sheet.Body>
        </Sheet.Dialog>
      </Sheet.Content>
    </Sheet.Backdrop>
  </Sheet>
);

test("sheet SSR: closed renders the trigger only", async () => {
  const html = await renderToString(() => <SheetFixture />);
  assert.match(html, /class="sheet__trigger"/);
  assert.match(html, />Open sheet</);
  assert.doesNotMatch(html, /sheet__dialog/);
  assert.doesNotMatch(html, /Sheet body/);
});

test("sheet SSR: defaultOpen renders the sheet with classes, slots, data attributes", async () => {
  const html = await renderToString(() => <SheetFixture defaultOpen placement="left" isDetached />);
  assert.match(html, /class="sheet__backdrop sheet__backdrop--opaque[^"]*"/);
  assert.match(html, /class="sheet__content sheet__content--detached sheet__content--left"/);
  assert.match(html, /class="sheet__dialog sheet__dialog--detached sheet__dialog--left"/);
  for (const name of ["sheet-backdrop", "sheet-content", "sheet-dialog", "sheet-handle", "sheet-handle-bar", "sheet-header", "sheet-heading", "sheet-body"])
    assert.match(html, new RegExp(`data-slot="${name}"`), name);
  assert.match(html, /data-sheet-drawer=""/);
  assert.match(html, /data-sheet-detached="true"/);
  assert.match(html, /data-placement="left"/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /Sheet body/);
  assert.doesNotMatch(html, /data-sheet-snap-points/);
});

test("sheet SSR: snap points place the sheet with a CSS transform + backdrop variable", async () => {
  const html = await renderToString(() => <SheetFixture defaultOpen snapPoints={[0.5, 1]} />);
  assert.match(html, /data-sheet-snap-points="true"/);
  assert.match(html, /transform: ?translateY\(max\(0px, calc\(100% - 50dvh\)\)\)/);
  assert.match(html, /--sheet-backdrop-opacity: ?0/, "below fadeFromIndex (last): transparent backdrop colour");
  const full = await renderToString(() => <SheetFixture defaultOpen snapPoints={[0.5, 1]} fadeFromIndex={0} />);
  assert.match(full, /--sheet-backdrop-opacity: ?1/);
  const top = await renderToString(() => <SheetFixture defaultOpen placement="top" snapPoints={["148px"]} />);
  assert.match(top, /translateY\(calc\(-1 \* max\(0px, calc\(100% - 148px\)\)\)\)/);
});
