import { signal } from "@rivetjs/reactivity";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Modal, ModalOverlay } from "@rivetjs/cdk/modal";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Popover } from "@rivetjs/cdk/popover";
import { Tooltip, TooltipTrigger } from "@rivetjs/cdk/tooltip";
import { OverlayArrow } from "@rivetjs/cdk/overlay-arrow";
import { Select } from "@rivetjs/cdk/select";
import { ComboBox } from "@rivetjs/cdk/combobox";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { ListBox } from "@rivetjs/cdk/listbox";

export const head = { title: "DOM events: overlays" };

const animals = [
  { key: "cat", label: "Cat" },
  { key: "dog", label: "Dog" },
];

// Global DOM events and attributes (RAC GlobalDOMAttributes) on Dialog, Modal, Popover, Tooltip,
// Select and ComboBox and their parts; every handler appends to #de-log.
export default function DomEventsOverlaysStory() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l, entry]);
  return (
    <section>
      <h1>DOM events: overlays</h1>
      <p id="de-log">{log().join(" ")}</p>
      <DialogTrigger>
        <Button id="de-dt-trigger" lang="fr" onClick={() => add("t-click")} onContextMenu={() => add("t-menu")}>
          Open dialog
        </Button>
        <ModalOverlay dir="rtl" onPointerDown={(e) => add("u-down:" + e.defaultPrevented)} onWheel={() => add("u-wheel")}>
          <Modal id="de-dt" lang="en" dir="ltr" onPointerEnter={() => add("m-enter")} onDblClick={() => add("m-dbl")}>
            <Dialog>
              <Heading slot="title">Dialog</Heading>
              <p>Modal content</p>
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
      <Dialog id="de-dialog" aria-label="Inline" lang="de" onDblClick={() => add("d-dbl")} onContextMenu={() => add("d-menu")}>
        <p>Inline dialog</p>
      </Dialog>
      <DialogTrigger>
        <Button id="de-pop-trigger" dir="rtl" onClick={() => add("pt-click")} onDblClick={() => add("pt-dbl")}>
          Popover
        </Button>
        <Popover id="de-pop" aria-label="Popover" lang="es" onDblClick={() => add("p-dbl")} onWheel={() => add("p-wheel")}>
          <OverlayArrow lang="pt" onContextMenu={() => add("pa-menu")}>
            <span style={{ display: "block", width: "12px", height: "6px" }} />
          </OverlayArrow>
          <p>Popover content</p>
        </Popover>
      </DialogTrigger>
      <div style={{ marginBlockStart: "80px", marginInlineStart: "80px" }}>
        <TooltipTrigger delay={0}>
          <Button id="de-tip-button">Tip trigger</Button>
          <Tooltip id="de-tip" lang="nl" onPointerEnter={() => add("tip-enter")} onDblClick={() => add("tip-dbl")}>
            <OverlayArrow lang="sv" onContextMenu={() => add("tipa-menu")}>
              <span style={{ display: "block", width: "8px", height: "4px" }} />
            </OverlayArrow>
            Tip
          </Tooltip>
        </TooltipTrigger>
      </div>
      <Select
        id="de-sel"
        label="Animal"
        items={animals}
        lang="en"
        onDblClick={() => add("s-dbl")}
        triggerProps={{ dir: "ltr", onClick: () => add("st-click"), onPointerDown: () => add("st-down"), onPointerEnter: () => add("st-enter") }}
        valueProps={{ lang: "en-GB", onContextMenu: () => add("sv-menu") }}
        popoverProps={{ lang: "fi", onWheel: () => add("sp-wheel") }}
        listBoxProps={{ dir: "ltr", onPointerDown: () => add("sl-down"), onDblClick: () => add("sl-dbl") }}
      />
      <ComboBox
        id="de-combo-input"
        defaultItems={animals}
        lang="en"
        onDblClick={() => add("c-dbl")}
        onKeyDown={(e) => add("c-key:" + e.key)}
        onFocusChange={(focused) => add("c-focus:" + focused)}
      >
        <Label>Fruit</Label>
        <Input onInput={() => add("c-input")} onPaste={() => add("c-paste")} />
        <Popover>
          <ListBox id="de-combo-list" lang="fr" onClick={() => add("cl-click")} onContextMenu={() => add("cl-menu")} />
        </Popover>
      </ComboBox>
    </section>
  );
}
