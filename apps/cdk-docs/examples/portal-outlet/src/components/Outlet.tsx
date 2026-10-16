import { signal, type Signal } from "@rivetjs/reactivity";
import { ComponentPortal, DomPortal, DomPortalOutlet, TemplatePortal, type Portal } from "@rivetjs/cdk/portal-outlet";

// #region demo
function Card(props: { name: string }) {
  return <p class="card m-0">Component: {props.name}</p>;
}

// A render function (Angular TemplateRef); JSX belongs in a function like this, not inline in a handler.
function Items(context: { count: number }) {
  return <p class="m-0">Template: {context.count} items</p>;
}

// Browser-only: the outlet for #po-outlet (created on first use, never serialized).
let outlet: DomPortalOutlet | undefined;

function show(doc: Document, portal: Portal<unknown> | null, status: Signal<string>) {
  outlet ??= new DomPortalOutlet(doc.getElementById("po-outlet")!);
  // One portal at a time: detach the current one (a DomPortal's element goes back home).
  if (outlet.hasAttached()) outlet.detach();
  if (portal) outlet.attach(portal);
  status.set(outlet.hasAttached() ? "attached" : "empty");
}

export function Outlet() {
  const status = signal("empty");
  return (
    <section class="m-4 grid gap-3 text-sm">
      <div class="flex flex-wrap gap-2">
        <button
          id="po-component"
          type="button"
          class="rounded border px-2"
          onClick={(e) => show(e.currentTarget.ownerDocument, new ComponentPortal(Card, { name: "Ada" }), status)}
        >
          ComponentPortal
        </button>
        <button
          id="po-template"
          type="button"
          class="rounded border px-2"
          onClick={(e) => show(e.currentTarget.ownerDocument, new TemplatePortal(Items, { count: 3 }), status)}
        >
          TemplatePortal
        </button>
        <button
          id="po-dom"
          type="button"
          class="rounded border px-2"
          onClick={(e) => show(e.currentTarget.ownerDocument, new DomPortal(e.currentTarget.ownerDocument.getElementById("po-note")!), status)}
        >
          DomPortal
        </button>
        <button id="po-detach" type="button" class="rounded border px-2" onClick={(e) => show(e.currentTarget.ownerDocument, null, status)}>
          Detach
        </button>
      </div>
      <div id="po-outlet" class="min-h-10 rounded border border-dashed border-slate-400 p-2" />
      <div id="po-home" class="text-slate-500">
        <p id="po-note" class="m-0">
          An element that lives here.
        </p>
      </div>
      <p id="po-status">{status()}</p>
    </section>
  );
}
// #endregion
