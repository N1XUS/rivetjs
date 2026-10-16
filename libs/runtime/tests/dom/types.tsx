import { signal, createContext } from "@rivetjs/reactivity";
import { mount, Provider, For } from "@rivetjs/runtime/dom";
const text = signal("hello"),
  checked = signal(false),
  token = createContext("default");
function Required(props: { label: string }) {
  return <span>{props.label}</span>;
}
const tree = (
  <section id="valid" data-id={1} aria-hidden={false}>
    <Required label="x" />
    <input
      type="text"
      model:value={text}
      onInput={(e) => {
        e.currentTarget.value = e.data ?? "";
      }}
    />
    <input type="checkbox" model:checked={checked} />
    <textarea model:value={text} />
    <label htmlFor="x">label</label>
    <svg viewBox="0 0 1 1">
      <circle cx={1} />
    </svg>
    <math>
      <mi>x</mi>
    </math>
    <Provider token={token} value="provided">
      <Required label="child" />
    </Provider>
    <For each={() => [1, 2]} by={(x) => x}>
      {(item, index) => <span>{item() + index()}</span>}
    </For>
  </section>
);
mount(() => tree, document.createElement("div"));
// @ts-expect-error component's required prop remains required
const missing = <Required />;
// @ts-expect-error writable model has the wrong value type
const wrongModel = <input model:value={checked} />;
// G9: select value / model:value (string, or string[] for multiple).
const picks = signal<string[]>([]);
const selects = (
  <div>
    <select model:value={text} value="a" />
    <select multiple model:value={picks} value={["a", 1]} />
  </div>
);
// @ts-expect-error select model takes a string or string[] signal
const wrongSelect = <select model:value={checked} />;
// @ts-expect-error checkbox model has the wrong value type
const wrongCheck = <input model:checked={text} />;
// @ts-expect-error textarea does not support checked models
const wrongArea = <textarea model:checked={checked} />;
// @ts-expect-error invalid native attribute
const wrongAttr = <input href="url" />;
// @ts-expect-error event currentTarget is an input, not an anchor
const wrongEvent = <input onInput={(e) => e.currentTarget.href} />;

// E13 / D-4: attributes and events the compiler accepts.
const media = (
  <div contentEditable="plaintext-only" inputMode="numeric" enterKeyHint="go" autoCapitalize="words" popover="manual" slot="s" nonce="n" itemProp="name" itemScope data-x="1" aria-label="l">
    <iframe src="/embed" allow="fullscreen; camera" allowFullScreen loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts" title="t" />
    <time dateTime="2026-10-04">today</time>
    <del dateTime="2026-01-01">old</del>
    <ins dateTime="2026-01-02" cite="/why">new</ins>
    <img src="/a.png" alt="" decoding="async" fetchPriority="high" crossOrigin="anonymous" />
    <video src="/v.mp4" crossOrigin="" playsInline />
    <my-widget level={3} label="x" onClick={(e) => e.currentTarget.tagName} data-y="2" />
    <input
      onBeforeInput={(e) => e.data}
      onKeyPress={(e) => e.key}
      onSelect={() => {}}
      onPointerCancel={(e) => e.pointerId}
      onTouchCancel={() => {}}
      onDragStart={(e) => e.dataTransfer}
      onDrop={(e) => e.dataTransfer}
      onClickCapture={() => {}}
      onDragOverCapture={(e) => e.dataTransfer}
    />
    <form onReset={() => {}} />
  </div>
);
const head = (
  <>
    <meta charset="utf-8" />
    <meta name="description" content="d" />
    <meta property="og:title" content="t" />
    <meta httpEquiv="refresh" content="0" />
    <link rel="preload" href="/f.woff2" as="font" type="font/woff2" crossOrigin="anonymous" fetchPriority="high" />
    <link rel="stylesheet" href="/s.css" integrity="sha384-x" media="print" blocking="render" />
  </>
);
// @ts-expect-error srcdoc is not supported (compile error)
const srcdoc = <iframe srcdoc="<p>x</p>" />;
// @ts-expect-error the compiler rejects unknown native events
const unknownEvent = <div onMagic={() => {}} />;
// @ts-expect-error custom elements: unknown events are compile errors too
const customEvent = <my-widget onMagic={() => {}} />;
// @ts-expect-error custom elements: unsafe attributes stay rejected
const customUnsafe = <my-widget innerHTML="<b>x</b>" />;
// @ts-expect-error dateTime belongs to time/del/ins
const wrongDate = <span dateTime="2026" />;
// G9: lib.dom events with their lib.dom event types.
const libDom = (
  <div
    onTransitionEnd={(e) => e.propertyName}
    onAnimationStart={(e) => e.animationName}
    onPaste={(e) => e.clipboardData}
    onToggle={(e) => e.newState}
    onPointerOver={(e) => e.pointerId}
    onInput={(e) => e.data}
  />
);
// @ts-expect-error lowercase-word typo of a lib.dom event
const typoEvent = <div onTransitionend={() => {}} />;
// G9: custom events and properties.
const customs = (
  <my-widget on:value-change={(e) => e.detail} on:openChanged={(e) => e.currentTarget} prop:items={[1, 2]} prop:open />
);
const nativeCustom = <div on:my-event={(e) => e.detail} prop:scrollTop={10} />;
// G10: class / style directives, class objects / arrays and style objects.
const on = signal(true);
const styled = (
  <div
    class={{ active: on(), big: true }}
    class:is-open={on()}
    class:plain
    style={{ color: "red", "--rv-x": 1, backgroundColor: on() ? "blue" : null, opacity: false }}
    style:margin-top={on() ? "1px" : undefined}
    style:z-index={2}
  >
    <span class={["a", on() && "b", ["c", { d: on() }], null]} />
    <svg class={{ icon: true }} style={{ fill: "none" }} />
    <my-widget class:on={on()} style={{ "--size": "2px" }} />
  </div>
);
// @ts-expect-error style strings are compile errors
const styleString = <div style="color: red" />;
// @ts-expect-error style object values are strings / numbers / null / undefined / false
const styleValue = <div style={{ color: { nested: true } }} />;
// @ts-expect-error style: values are strings / numbers / null / undefined / false
const styleDirective = <div style:color={{ value: "red" }} />;
