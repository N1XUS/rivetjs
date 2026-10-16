---
title: Presence and exit animations
description: Play an exit animation before content unmounts with Presence and PresenceFor, also inside kit Transition and cdk overlays.
template: guide
status: experimental
related: [guides/motion/index, guides/components/lists, ui/kit, reference/motion]
---

An element that disappears usually unmounts at once. `exit` gives it an animation, and a presence keeps it in the page until that animation finished. After reading this page you can animate content out, animate rows out of a list, and add exits inside cdk overlays.

::example{id=motion-presence}

## Presence

```tsx
import { Motion } from "@rivetjs/motion";
import { Presence } from "@rivetjs/motion/presence";

const open = signal(true);

<Presence show={open}>
  {() => <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }} />}
</Presence>;
```

- `show`: a value, a signal or an accessor.
- The children are a function: the content is created while shown.
- When `show` turns false, every Motion element with `exit` inside plays it (`data-exiting` is set meanwhile), then the content unmounts. If `show` turns true again during the exit, the same elements animate back.
- `initial={false}`: content shown on the first render skips its entrance (later opens play it).
- `unmount={false}`: keep the content in the page (hidden) after the exit.
- `onExitComplete()`: after the exit finished and the content left.

## Lists: PresenceFor

`PresenceFor` is a keyed list like [`For`](../components/lists.md) whose removed rows stay at their place while they leave:

```tsx
import { PresenceFor } from "@rivetjs/motion/presence";

<ul>
  <PresenceFor each={todos} by={(todo) => todo.id}>
    {(todo) => (
      <Motion.li animate={{ opacity: 1 }} exit={{ opacity: 0, x: 24 }}>
        {todo().text}
      </Motion.li>
    )}
  </PresenceFor>
</ul>;
```

- `by` gives each row its key. Derive it from the item: a leaving row is keyed again at its new index.
- A removed row keeps `data-exiting` until its exit finished, then drops out. Adding the key back while it leaves brings the same row back.
- `onExitComplete(key)` reports each row that left.
- Close the gap while a row leaves (motion/react's `popLayout`): take leaving rows out of the flow with `data-exiting:absolute data-exiting:inset-x-0` on the row and `relative` on a block-flow list (in a flex column an absolute row jumps to the start), and wrap the removal in `animateLayout(list, () => …)` with `layout` rows. Example: ui-docs `motion-toast-stack`.
- `todo` is `For`'s own item accessor, so handlers in rows resume like in any list.

## Exits inside kit Transition and cdk overlays

Every kit transition scope is a presence: kit `Transition` / `TransitionPresence`, cdk `Modal`, `Popover` and the overlays built on them. A Motion element with `exit` inside one plays its exit when the overlay closes, and the overlay waits for it. No `Presence` wrapper is needed:

```tsx
<Modal isOpen={open} onOpenChange={(value) => open.set(value)}>
  <Motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>
    …
  </Motion.div>
</Modal>
```

- The overlay's own CSS exit (a ui backdrop's fade) keeps its end state until the Motion exits finished; with no CSS animation (reduced motion, `animation: none`) the backdrop stays as it is during the Motion exit, then disappears with the overlay.
- A server-open overlay dismissed as the first interaction of a resumed page exits the same way: the re-created overlay knows it was open (region state), and Motion elements created while it leaves start from their final state.

### Springs for overlays

Overlays keep their default timing. To give the `@rivetjs/ui` overlays (Modal, Drawer, AlertDialog, Sheet) a spring on enter and exit, set the motion token (read when the overlay opens):

```css
:root {
  --rv-motion-spring: 0.3 0.2; /* visual duration in seconds, bounce */
}
```

With `@rivetjs/ui`, the theme option `motion: { overlays: "spring" }` sets it for you. A plain cdk `Modal` reads the token only when you register the hook (the cdk alone ships none of this code):

```ts
import { applyMotionToken, modalHooks } from "@rivetjs/cdk/modal";

modalHooks.open = (overlay, modal) => {
  applyMotionToken(overlay);
  applyMotionToken(modal);
};
```
