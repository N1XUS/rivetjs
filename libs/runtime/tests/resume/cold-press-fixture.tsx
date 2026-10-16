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
    </main>
  );
}
