// A cold press's mousedown focus move (resume-cold-press-browser.test.ts, lane RESUME-PINS): the move runs natively at
// dispatch; once the chunk loaded the runtime puts focus back, runs the handlers, then focuses as the default would
// unless a handler canceled it.
// Each case is its own component (own chunk, delayed by the test).
const count = (key: string): void => {
  const g = globalThis as unknown as Record<string, number>;
  g[key] = (g[key] ?? 0) + 1;
};

/** A radio label's shape (RA useRadio): the handler cancels the focus move. */
function Held() {
  return (
    <button
      id="held"
      type="button"
      onMouseDown={(event: MouseEvent) => {
        event.preventDefault();
        count("__held");
      }}
    >
      held
    </button>
  );
}

/** A handler that leaves the default: focus lands on the button once it ran. */
function Plain() {
  return (
    <button id="plain" type="button" onMouseDown={() => count("__plain")}>
      plain
    </button>
  );
}

/** A NumberField stepper's shape (`preventFocusOnPress` + focus the field on press start). */
function Moves() {
  return (
    <div>
      <input id="field" aria-label="field" />
      <span
        id="moves"
        tabIndex={-1}
        onMouseDown={(event: MouseEvent) => {
          event.preventDefault();
          document.getElementById("field")!.focus();
          count("__moves");
        }}
      >
        step
      </span>
    </div>
  );
}

/** RA `preventFocus` (usePress `preventFocusOnPress`): no cancel, the coming focus move is swallowed and the
 * previously active element refocused. */
function Guard() {
  return (
    <button
      id="guard"
      type="button"
      onMouseDown={(event: MouseEvent) => {
        const active = document.activeElement as HTMLElement | null,
          self = event.currentTarget;
        const guard = (e: FocusEvent) => {
          if (e.target !== self) return;
          window.removeEventListener("focusin", guard, true);
          active?.focus();
        };
        window.addEventListener("focusin", guard, true);
        count("__guard");
      }}
    >
      guard
    </button>
  );
}

/** Text entry keeps its native mousedown (caret placement): never held. */
function Text() {
  return <input id="text" aria-label="text" onMouseDown={() => count("__text")} />;
}

/** A handler on a non-focusable box: focus leaves the active element, as natively. */
function Blur() {
  return (
    <p id="blur" onMouseDown={() => count("__blur")}>
      plain text
    </p>
  );
}

/** A canceling handler on a non-focusable box (a `preventDefault` div, an RA radio label's text): focus stays. */
function Keep() {
  return (
    <div
      id="keep"
      onMouseDown={(event: MouseEvent) => {
        event.preventDefault();
        count("__keep");
      }}
    >
      keep focus
    </div>
  );
}

/** An href-less link reports `tabIndex` 0 but takes no focus: the press's default focuses the focusable ancestor
 * (disabled controls too, but Chromium dispatches no mouse events to them). The handler records the element focused when it runs (a loaded page: still `#before`). */
function Inert() {
  return (
    <div
      id="inert"
      tabIndex={-1}
      onMouseDown={() => {
        (globalThis as unknown as Record<string, string>).__inertSaw = document.activeElement?.id ?? "";
        count("__inert");
      }}
    >
      <a id="anchor">anchor</a>
    </div>
  );
}

/** The same with a canceling handler: focus stays where it was. */
function InertKeep() {
  return (
    <div
      id="inert-keep"
      tabIndex={-1}
      onMouseDown={(event: MouseEvent) => {
        event.preventDefault();
        count("__inertKeep");
      }}
    >
      <a id="anchor-keep">anchor</a>
    </div>
  );
}

/** A followed link with a click handler: the loader holds the cold click's default and replays the click. */
function Follow() {
  return (
    <a id="follow" href="#followed" onClick={() => count("__follow")}>
      follow
    </a>
  );
}

/** A menu trigger's shape (RA usePress / useMenuTrigger press start): the pointerdown handler focuses the pressed
 * element; the mousedown handler records where focus is (a loaded page: already the trigger). */
function Grab() {
  return (
    <button
      id="grab"
      type="button"
      onPointerDown={(event: PointerEvent) => {
        (globalThis as unknown as Record<string, string>).__grabDown = document.activeElement?.id ?? "";
        (event.currentTarget as HTMLElement).focus();
        count("__grab");
      }}
      onMouseDown={() => {
        (globalThis as unknown as Record<string, string>).__grabMouse = document.activeElement?.id ?? "";
        count("__grabPressed");
      }}
    >
      grab
    </button>
  );
}

/** Two cold presses queued before the chunks land: A's mousedown handler cancels the focus move (a stepper's
 * `preventFocusOnPress` shape), B's pointerdown handler focuses B (a menu trigger). */
function TwoA() {
  return (
    <button
      id="two-a"
      type="button"
      onPointerDown={() => count("__twoAp")}
      onMouseDown={(event: MouseEvent) => {
        event.preventDefault();
        count("__twoAm");
      }}
    >
      two a
    </button>
  );
}

function TwoB() {
  return (
    <button
      id="two-b"
      type="button"
      onPointerDown={(event: PointerEvent) => {
        (event.currentTarget as HTMLElement).focus();
        count("__twoBp");
      }}
      onMouseDown={() => count("__twoBm")}
    >
      two b
    </button>
  );
}

/** Steppers (`preventFocusOnPress` shape) and a plain button for the A, B, A, C cold-press sequence. */
function CycA() {
  return (
    <button
      id="cyc-a"
      type="button"
      onPointerDown={() => count("__cycAp")}
      onMouseDown={(event: MouseEvent) => {
        event.preventDefault();
        count("__cycAm");
      }}
    >
      cyc a
    </button>
  );
}

function CycB() {
  return (
    <button
      id="cyc-b"
      type="button"
      onPointerDown={() => count("__cycBp")}
      onMouseDown={(event: MouseEvent) => {
        event.preventDefault();
        count("__cycBm");
      }}
    >
      cyc b
    </button>
  );
}

function CycC() {
  return (
    <button id="cyc-c" type="button" onMouseDown={() => count("__cycC")}>
      cyc c
    </button>
  );
}

/** A replayed handler installing a document listener (cdk TooltipTrigger close-on-press, RA usePress document
 * `pointerup`): the cold click replayed after it reaches that listener (COLDFIX 2026-10-19). */
function Late() {
  return (
    <button
      id="late"
      type="button"
      onMouseDown={() => {
        document.addEventListener("click", () => count("__late"), { capture: true, once: true });
        count("__lateDown");
      }}
      onClick={() => count("__lateClick")}
    >
      late
    </button>
  );
}

/** A collection root's shape (RA useSelectableCollection mousedown): the cancel keeps focus where it was, so the focus
 * the native mouse focus queued never replays (COLDFIX 2026-10-19, cdk fuzz `/tag-group`). */
function Drop() {
  return (
    <button
      id="drop"
      type="button"
      onMouseDown={(event: MouseEvent) => {
        event.preventDefault();
        count("__drop");
      }}
      onFocus={() => count("__dropFocus")}
    >
      drop
    </button>
  );
}

/** A range calendar's shape: the root commits on `focusout` when focus leaves mid-selection (a cold press from outside). */
function Leave() {
  return (
    <div id="leave" onFocusOut={() => count("__leaveOut")} onPointerDown={() => count("__leavePress")}>
      <button id="leave-cell" type="button">
        cell
      </button>
    </div>
  );
}

/** A cdk group's focus-within shape (RA useFocusWithin): `focusin` / `focusout` write `data-focus-within`; while within, a
 * native document `focusin` listener clears it when focus lands outside (a cold press's native focus move must not reach it). */
function Within() {
  return (
    <div
      id="within"
      onFocusIn={(event: FocusEvent) => {
        const group = event.currentTarget as HTMLElement;
        if (group.hasAttribute("data-focus-within") || document.activeElement !== event.target) return;
        group.setAttribute("data-focus-within", "true");
        count("__withinIn");
        const away = (e: FocusEvent) => {
          if (group.contains(e.target as Node)) return;
          document.removeEventListener("focusin", away, true);
          group.removeAttribute("data-focus-within");
        };
        document.addEventListener("focusin", away, true);
      }}
      onFocusOut={(event: FocusEvent) => {
        const group = event.currentTarget as HTMLElement;
        if (!group.contains(event.relatedTarget as Node | null)) group.removeAttribute("data-focus-within");
      }}
    >
      <input id="within-input" aria-label="within" />
    </div>
  );
}

/** A NumberField stepper outside that group with RA `preventFocus` (`preventFocusOnPress`): the focused field keeps focus,
 * its `focusout` / the stepper's `focusin` never reach other listeners (window capture, `stopImmediatePropagation`). */
function Stepper() {
  return (
    <button
      id="stepper"
      type="button"
      tabIndex={-1}
      onMouseDown={(event: MouseEvent) => {
        const active = document.activeElement as HTMLElement | null,
          self = event.currentTarget;
        let refocusing = false;
        const out = (e: FocusEvent) => (e.target === active || refocusing) && e.stopImmediatePropagation();
        const into = (e: FocusEvent) => {
          if (e.target !== self && !refocusing) return;
          e.stopImmediatePropagation();
          if (refocusing) return;
          refocusing = true;
          active?.focus();
          window.removeEventListener("focusout", out, true);
          window.removeEventListener("focusin", into, true);
        };
        window.addEventListener("focusout", out, true);
        window.addEventListener("focusin", into, true);
        count("__stepper");
      }}
    >
      step
    </button>
  );
}

/** A ComboBox's shape: a group (RA useFocusWithin: `activeElement === target` guard) around its input and trigger; the
 * test focuses the input from a native pointerdown listener (a live press start) while the group's chunk is cold. */
function Combo() {
  return (
    <div
      id="combo"
      onFocusIn={(event: FocusEvent) => {
        if (document.activeElement === event.target) (event.currentTarget as HTMLElement).setAttribute("data-focus-within", "true");
      }}
    >
      <input id="combo-input" aria-label="combo" />
      <button id="combo-trigger" type="button" onMouseDown={() => count("__comboDown")}>
        open
      </button>
    </div>
  );
}

/** A Select trigger's shape: the press start opens what covers the trigger, so a loaded page's pointerup lands on the
 * cover and the click on the common ancestor (`#cover`): the trigger's `onClick` never runs. */
function Cover() {
  return (
    <div
      id="cover"
      style={{ position: "relative" }}
      onClick={(event: MouseEvent) => ((globalThis as unknown as Record<string, unknown>).__coverAt = (event.target as Element).id)}
    >
      <button
        id="cover-trigger"
        type="button"
        onPointerDown={(event: PointerEvent) => {
          const sheet = document.createElement("div");
          sheet.id = "cover-sheet";
          sheet.style.cssText = "position:absolute;inset:0;z-index:1";
          (event.currentTarget as Element).parentElement!.append(sheet);
          count("__coverDown");
        }}
        onPointerUp={() => count("__coverUp")}
        onClick={() => count("__coverClick")}
      >
        cover
      </button>
    </div>
  );
}

export function Page() {
  return (
    <main>
      <input id="before" aria-label="before" />
      <Held />
      <Plain />
      <Moves />
      <Guard />
      <Text />
      <Blur />
      <Keep />
      <Inert />
      <Follow />
      <Grab />
      <TwoA />
      <TwoB />
      <CycA />
      <CycB />
      <CycC />
      <InertKeep />
      <Late />
      <Drop />
      <Leave />
      <Within />
      <Stepper />
      <Cover />
      <Combo />
    </main>
  );
}
