---
title: Hooks
description: "The root hooks of @rivetjs/ui as plain Rivet functions: signals and accessors instead of React state."
template: guide
status: experimental
related: [start/differences, start/dark-mode, components/modal]
---

The hooks exported from `@rivetjs/ui` are plain functions, not React hooks: call them once while a component renders, and read what they return as accessors (`mounted()`), the same as any signal. Nothing runs on the server except the initial value. Each hook is its own module, so an app that does not import one pays nothing for it.

```tsx
import { useMediaQuery, useMounted, useTheme } from "@rivetjs/ui";
```

| Hook                                                        | Returns                                      | Notes                                                                                                                                                             |
| ----------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useOverlayState({ isOpen?, defaultOpen?, onOpenChange? })` | `{ isOpen(), setOpen, open, close, toggle }` | Controls a Modal, AlertDialog, Drawer or Popover: `<Modal state={state}>`.                                                                                        |
| `useListData(options)`                                      | list state with signals                      | The `@rivetjs/cdk/data` list data (`items()`, `append`, `remove`, `update`, selection, filter text) under the HeroUI name.                                        |
| `useMediaQuery(query, defaultValue = false)`                | `() => boolean`                              | `matchMedia` follower. The server and the first paint use `defaultValue`; the browser reads the real match, then follows changes. `query` may be an accessor.     |
| `useMeasuredHeight(target)`                                 | `() => number`                               | Height in px of an element (or a `ref()` / accessor returning one), kept current by a `ResizeObserver`. `0` until measured.                                       |
| `useTheme({ defaultTheme?, storageKey? })`                  | `{ theme(), resolvedTheme(), setTheme(t) }`  | Reads and writes the `light` / `dark` class, `data-theme` and `color-scheme` on `<html>`; `"system"` follows `prefers-color-scheme`. See below.                   |
| `useMounted()` / `useIsHydrated()`                          | `() => boolean`                              | `false` on the server, `true` once the client effects ran. Rivet has no hydration pass, so both mean the same.                                                    |
| `useSafeLayoutEffect(fn)` / `useIsomorphicLayoutEffect(fn)` | `void`                                       | The same function as `clientEffect` from `@rivetjs/runtime/dom`: never on the server, runs in the browser, `return` a cleanup. Prefer `clientEffect` in new code. |

## Theme

`useTheme` does not render a provider and does not persist unless you pass `storageKey`. Set the theme before first paint with a script in the document head (see [Dark Mode](/start/dark-mode/)) and use the hook for the switcher:

```tsx
import { Button } from "@rivetjs/ui/button";
import { useTheme } from "@rivetjs/ui";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme({ storageKey: "theme" });
  return <Button onPress={() => setTheme(resolvedTheme() === "dark" ? "light" : "dark")}>Toggle theme</Button>;
}
```

## Resumability

Hooks that observe the browser (`useMediaQuery`, `useMeasuredHeight`, `useTheme`, `useMounted`) start from their server value and update from a client effect, so a resumed page keeps the server markup until the owning component boots. Gate browser-only markup with `useMounted()`; do not branch on `typeof window` while rendering.
