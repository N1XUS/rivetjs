import { signal } from "@rivetjs/reactivity";

export function Classes(props: { initial?: string | number; placement?: boolean; early?: boolean; foreign?: boolean }) {
  const count = signal(0);
  const name = () => (count() === 0 ? props.initial : count() === 1 ? "slide" : "");
  const place = (el: Element) => {
    if (props.placement && el.isConnected) count.set(1);
  };
  const initialize = (el: Element) => {
    if (el.isConnected && props.foreign !== false) for (const child of el.querySelectorAll("#bound, #spread, #svg")) child.classList.add("is-snapped");
    if (props.early) place(el);
  };
  return (
    <main ref={initialize}>
      <button id="wake" onFocus={(event) => event.currentTarget.setAttribute("data-ready", "")} onClick={() => count.set(count() + 1)}>
        Change
      </button>
      <div id="bound" class={name()} />
      <div id="spread" {...{ class: name() }} />
      <svg>
        <g id="svg" class={name()} />
      </svg>
      <div ref={place} />
      <output id="count">{count()}</output>
    </main>
  );
}

export function ChangedParent(props: { next: string | null; foreign: boolean }) {
  const value = signal<string | undefined>("server-old");
  return (
    <main
      ref={(el) => {
        if (!el.isConnected) return;
        if (props.foreign) for (const child of el.querySelectorAll("#changed-bound, #changed-spread, #changed-svg")) child.classList.add("is-snapped");
        value.set(props.next ?? undefined);
      }}
    >
      <button id="changed-wake" onFocus={(event) => event.currentTarget.setAttribute("data-ready", "")}>
        Wake
      </button>
      <ChangedChild value={value()} />
    </main>
  );
}

export function ChangedChild(props: { value?: string }) {
  return (
    <section>
      <button id="changed-bound" class={props.value} onClick={(event) => event.currentTarget.setAttribute("data-clicked", "")}>
        Child
      </button>
      <div id="changed-spread" {...{ class: props.value }} />
      <svg>
        <g id="changed-svg" class={props.value} />
      </svg>
    </section>
  );
}
