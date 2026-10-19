import { signal } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/cdk/button";
import { PortalProvider } from "@rivetjs/cdk/portal";
import { Tooltip, TooltipTrigger } from "@rivetjs/cdk/tooltip";
import { OverlayArrow } from "@rivetjs/cdk/overlay-arrow";
import { Focusable } from "@rivetjs/cdk/focusable";

export const head = { title: "Tooltip" };

// Stories for react-aria-components test/Tooltip.test.js (TestTooltip and friends) plus the
// warmup / cooldown, focus-only, disabled and standalone cases.
export default function TooltipStory() {
  const open = signal(false);
  const changes = signal("");
  const anchor = ref<HTMLSpanElement>();
  const focusLog = signal("");
  const open2 = signal(false);
  const changes2 = signal("");
  const anchor2 = ref<HTMLSpanElement>();
  // Live `isDisabled` on the trigger Button (ui InputGroup "With TextArea" send button): updates in place.
  const prompt = signal("");
  const sends = signal(0);
  return (
    <section>
      <h1>Tooltip</h1>
      <div style={{ display: "flex", gap: "2rem", marginBlockStart: "120px", marginInlineStart: "120px", flexWrap: "wrap" }}>
        <TooltipTrigger delay={0}>
          <Button id="edit-button" aria-label="Edit button">
            <span aria-hidden="true">E</span>
          </Button>
          <Tooltip id="edit" data-test="tooltip">
            <OverlayArrow>
              <span
                class="tip"
                style={{ display: "block", width: "8px", height: "8px", background: "currentColor", clipPath: "polygon(0 0, 100% 0, 50% 100%)" }}
              />
            </OverlayArrow>
            Edit
          </Tooltip>
        </TooltipTrigger>
        <TooltipTrigger delay={0}>
          <Button id="pending-button" isPending>
            Pending Button
          </Button>
          <Tooltip id="pending">Tooltip content</Tooltip>
        </TooltipTrigger>
        <TooltipTrigger delay={0}>
          <Button id="render-button" aria-label="Render props">
            <span aria-hidden="true">R</span>
          </Button>
          <Tooltip id="render" placement="bottom start">
            {({ placement }) => <>Content at {placement()}</>}
          </Tooltip>
        </TooltipTrigger>
        <TooltipTrigger delay={0}>
          <Button id="styled-button">Styled</Button>
          <Tooltip id="styled" style={{ zIndex: 5 }}>
            Styled
          </Tooltip>
        </TooltipTrigger>
        <TooltipTrigger>
          <Focusable>
            {(p) => (
              <span {...p} ref={p.ref as never} id="focusable-span" role="button">
                Trigger
              </span>
            )}
          </Focusable>
          <Tooltip id="focusable">Test</Tooltip>
        </TooltipTrigger>
        <TooltipTrigger>
          <Button id="excluded-button" excludeFromTabOrder>
            Check my tabindex
          </Button>
          <Tooltip id="excluded">hello world</Tooltip>
        </TooltipTrigger>
        <TooltipTrigger trigger="focus" delay={0}>
          <Button id="focus-only-button">Focus only</Button>
          <Tooltip id="focus-only">Focus only</Tooltip>
        </TooltipTrigger>
        <TooltipTrigger isDisabled delay={0}>
          <Button id="disabled-button">Disabled tooltip</Button>
          <Tooltip id="disabled">Disabled</Tooltip>
        </TooltipTrigger>
        <TooltipTrigger delay={0} shouldCloseOnPress={false}>
          <Button id="keep-button">Keep on press</Button>
          <Tooltip id="keep">Kept on press</Tooltip>
        </TooltipTrigger>
        <TooltipTrigger onOpenChange={(isOpen) => changes.update((s) => s + (isOpen ? "o" : "c"))}>
          <Button id="warm-1-button">Warm 1</Button>
          <Tooltip id="warm-1" class="rv-Tooltip overlay-anim">
            First
          </Tooltip>
        </TooltipTrigger>
        <TooltipTrigger closeDelay={100}>
          <Button id="warm-2-button">Warm 2</Button>
          <Tooltip id="warm-2" class="rv-Tooltip overlay-anim">
            Second
          </Tooltip>
        </TooltipTrigger>
        <TooltipTrigger delay={0}>
          <Button id="events-button" onFocus={() => focusLog.update((s) => s + "f")} onBlur={() => focusLog.update((s) => s + "b")}>
            Events
          </Button>
          <Tooltip id="events">With handlers</Tooltip>
        </TooltipTrigger>
      </div>
      <div>
        <Button id="live-disabled-fill" onPress={() => prompt.set(prompt() ? "" : "Hi")}>
          Fill prompt
        </Button>
        <TooltipTrigger delay={0}>
          <Button id="live-disabled-button" isDisabled={!prompt().trim()} onPress={() => sends.set(sends() + 1)}>
            Send
          </Button>
          <Tooltip id="live-disabled">Send prompt</Tooltip>
        </TooltipTrigger>
        <output id="live-disabled-sends">{sends()}</output>
      </div>
      <p id="focus-log">log={focusLog()}</p>
      <p id="tooltip-changes">changes={changes()}</p>
      <div id="scroll-container" style={{ display: "flex", flexDirection: "column", gap: "30px", overflow: "scroll", height: "200px", width: "300px" }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((idx) => (
          <TooltipTrigger delay={0}>
            <Button aria-label={`trigger-${idx}`}>
              <span aria-hidden="true">{idx}</span>
            </Button>
            <Tooltip id={`scroll-${idx}`}>{`Tooltip-${idx}`}</Tooltip>
          </TooltipTrigger>
        ))}
      </div>
      <PortalProvider container="#custom-container">
        {() => (
          <TooltipTrigger delay={0}>
            <Button id="portal-button">Portal</Button>
            <Tooltip id="portal">In container</Tooltip>
          </TooltipTrigger>
        )}
      </PortalProvider>
      <div id="custom-container" data-testid="custom-container" />
      <span id="anchor" ref={anchor} style={{ display: "inline-block", marginInlineStart: "300px" }}>
        Anchor
      </span>
      <Button id="toggle-standalone" onPress={() => open.set(!open())}>
        Toggle standalone
      </Button>
      <Tooltip id="standalone" triggerRef={anchor} isOpen={open} placement="bottom">
        Anchored to a span
      </Tooltip>
      <span id="anchor-2" ref={anchor2} style={{ display: "inline-block", marginInlineStart: "300px" }}>
        Anchor 2
      </span>
      <Button id="toggle-standalone-2" onPress={() => open2.set(!open2())}>
        Toggle standalone 2
      </Button>
      <Tooltip
        id="standalone-2"
        triggerRef={anchor2}
        isOpen={open2}
        onOpenChange={(isOpen: boolean) => changes2.update((s) => s + (isOpen ? "o" : "c"))}
        placement="bottom"
      >
        Controlled with onOpenChange
      </Tooltip>
      <p id="standalone-2-changes">changes={changes2()}</p>
      <div style={{ blockSize: "1200px" }} />
    </section>
  );
}
