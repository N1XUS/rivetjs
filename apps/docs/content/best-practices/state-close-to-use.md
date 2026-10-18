---
title: Keep state close to where it is used
description: Create each signal in the smallest component that needs it, so less state goes into the page and less code runs when it changes.
template: best-practice
related: [guides/state/signals, learn/resuming, guides/components/context, guides/performance/chunks]
---

**Create a signal in the lowest component that reads or writes it. Move it up only when two siblings need to share it.**

## Why

In Rivet, the browser does not run your components again. It picks up where the server left off: each handler and each binding that reads a signal is written into the page, together with the values it needs. Where you put a signal decides how much of that there is.

- **Less data in the page.** A signal is written into the page only when browser code uses it. A signal in a small component is captured by that component's handlers only.
- **Smaller updates.** When a signal changes, Rivet updates the parts that read it. If a large parent reads it in a JSX expression (`{open() ? <Panel /> : null}`), the whole expression is rebuilt. Read it deep in the tree and only that small part changes.
- **Less code sent.** Browser code is cut per handler and binding: a signal read deep in a small component pulls in only the small part that reads it, not a re-render of the page around it. With `chunks: "component"`, each component's code is also its own file, so a click loads only that component's code.
- **Easier to read.** The state and the code that changes it sit in one file.

## Do

```tsx title="src/components/Accordion.tsx" prefer
import { signal } from "@rivetjs/reactivity";

export function Accordion({ title, text }: { title: string; text: string }) {
  // Only this component knows whether it is open.
  const open = signal(false);
  return (
    <section>
      <button type="button" aria-expanded={open() ? "true" : "false"} onClick={() => open.update((v) => !v)}>
        {title}
      </button>
      <p hidden={!open()}>{text}</p>
    </section>
  );
}
```

## Don't

```tsx title="src/routes/faq.tsx" avoid
import { signal } from "@rivetjs/reactivity";

export default function Faq() {
  // One signal per item, all in the page component, passed down as props.
  const open = [signal(false), signal(false), signal(false)];
  return (
    <main>
      {/* Reading open[0]() here makes this whole block one unit that is rebuilt on change. */}
      {open[0]() ? <LongAnswer /> : <ShortAnswer />}
      <Item open={open[1]} />
      <Item open={open[2]} />
    </main>
  );
}
```

## When to break it

- **Shared state.** When two components must show the same value (a cart badge and a cart page), create the signal in their closest common parent and pass the signal down as a prop. For many levels, use [context](/guides/components/context.md).
- **State that must survive navigation.** The root `_layout.tsx` stays on the page while the router changes pages. Put state there when it must outlive a page, for example a music player.
- **State the server must know.** If a value decides what the server renders (a filter, a page number), keep it in the URL instead of a signal.
