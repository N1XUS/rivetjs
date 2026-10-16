import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { OverlayArrow } from "@rivetjs/cdk/overlay-arrow";
import { Popover } from "@rivetjs/cdk/popover";

export const head = { title: "Popover with plain CSS" };

// #region demo
export default function PlainCss() {
  return (
    <section style={{ margin: "1rem" }}>
      <DialogTrigger>
        <Button id="pcss-trigger">What is this?</Button>
        <Popover offset={10}>
          <OverlayArrow>
            <span class="tip" />
          </OverlayArrow>
          <Dialog id="pcss">
            <Heading slot="title">Plain CSS</Heading>
            <p>Styled by a stylesheet on the default class names.</p>
          </Dialog>
        </Popover>
      </DialogTrigger>
    </section>
  );
}
// #endregion
