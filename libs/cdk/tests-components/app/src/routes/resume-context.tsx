// Identified cdk contexts around a resumed region: `PortalProvider` and `I18nProvider` outside any
// region wrap a component that re-creates on its first change (root Show over an `open` signal).
// The re-created content must still read both providers (`resumableContext` registration).
import { signal } from "@rivetjs/reactivity";
import { ref, Show } from "@rivetjs/runtime/dom";
import { Portal, PortalProvider } from "@rivetjs/cdk/portal";
import { I18nProvider, useLocale } from "@rivetjs/cdk/i18n-provider";

/** Re-created content: reads both providers (its chunk loads the modules that register the tokens). */
function Portaled(props: { id: string }) {
  const locale = useLocale();
  const id = props.id;
  return (
    <Portal>
      <p id={id + "-portaled"} data-locale={locale.locale}>
        portaled
      </p>
    </Portal>
  );
}

function Opener(props: { id: string }) {
  const open = signal(false);
  const locale = useLocale();
  const id = props.id;
  return (
    <div id={id + "-region"} data-locale={locale.locale}>
      <button id={id + "-toggle"} type="button" onClick={() => open.set(!open())}>
        toggle
      </button>
      <span id={id + "-open"}>{String(open())}</span>
      <Show when={() => open()}>
        <Portaled id={id} />
      </Show>
    </div>
  );
}

export const head = { title: "Resume context" };

export default function ResumeContext() {
  // Element-ref container: a `ref()` to a server-rendered element serializes as an element ref, so the
  // re-created portal still mounts into it (a raw Element / plain function would not serialize).
  const host = ref<HTMLElement>();
  return (
    <section>
      <h1>Resume context</h1>
      <div id="rc-host"></div>
      <PortalProvider container="#rc-host">
        <I18nProvider locale="de-DE">
          <Opener id="rc" />
        </I18nProvider>
      </PortalProvider>
      <div id="re-host" ref={host}></div>
      <PortalProvider container={host}>
        <I18nProvider locale="fr-FR">
          <Opener id="re" />
        </I18nProvider>
      </PortalProvider>
    </section>
  );
}
