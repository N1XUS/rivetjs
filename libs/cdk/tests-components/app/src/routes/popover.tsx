import { signal } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { Popover } from "@rivetjs/cdk/popover";
import { OverlayArrow } from "@rivetjs/cdk/overlay-arrow";
import { DialogTrigger, Dialog } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Button } from "@rivetjs/cdk/button";

export const head = { title: "Popover" };

// RAC composition: DialogTrigger > Button + Popover (> OverlayArrow) > Dialog; standalone Popover with
// triggerRef + isOpen. Stories for react-aria-components test/Popover.test.js.
export default function PopoverStory() {
  const open = signal(false);
  const anchor = ref<HTMLSpanElement>();
  return (
    <section>
      <h1>Popover</h1>
      <DialogTrigger>
        <Button id="info-trigger">Details</Button>
        <Popover>
          <Dialog id="info">
            <Heading slot="title">Shipping</Heading>
            <p id="info-description">Ships in 2 days.</p>
            <a href="/">More</a>
          </Dialog>
        </Popover>
      </DialogTrigger>
      <div style={{ display: "flex", gap: "1rem", marginBlockStart: "200px", marginInlineStart: "200px" }}>
        <DialogTrigger>
          <Button id="help-trigger" aria-label="Help">
            ?
          </Button>
          <Popover placement="top" offset={12} crossOffset={4}>
            <OverlayArrow>
              <span style={{ display: "block", width: "12px", height: "6px", background: "#0f172a", clipPath: "polygon(0 0, 100% 0, 50% 100%)" }} />
            </OverlayArrow>
            <Dialog id="help">
              {({ close }) => (
                <>
                  <p>For help accessing your account, please contact support.</p>
                  <button type="button" id="help-close" onClick={() => close()}>
                    Dismiss
                  </button>
                </>
              )}
            </Dialog>
          </Popover>
        </DialogTrigger>
        <DialogTrigger>
          <Button id="nonmodal-trigger">Non-modal</Button>
          <Popover isNonModal placement="end">
            <Dialog id="nonmodal">
              <Heading slot="title">Non-modal</Heading>
              <button type="button" id="nonmodal-inside">
                Inside
              </button>
            </Dialog>
          </Popover>
        </DialogTrigger>
        <DialogTrigger>
          <Button id="locked-trigger">Locked</Button>
          <Popover isKeyboardDismissDisabled>
            <Dialog id="locked">
              <Heading slot="title">Locked</Heading>
              <p>Escape does not close.</p>
            </Dialog>
          </Popover>
        </DialogTrigger>
      </div>
      <button type="button" id="outside">
        Outside
      </button>
      <span id="anchor" ref={anchor} style={{ display: "inline-block", marginInlineStart: "300px" }}>
        Anchor
      </span>
      <Button id="open-standalone" onPress={() => open.set(true)}>
        Open standalone
      </Button>
      <Popover id="standalone" triggerRef={anchor} isOpen={open} aria-label="Standalone">
        <p>Anchored to a span.</p>
      </Popover>
      <p id="popover-value">standalone={open() ? "open" : "closed"}</p>
      <div style={{ blockSize: "2000px" }} />
    </section>
  );
}
