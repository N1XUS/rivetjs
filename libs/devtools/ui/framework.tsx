// Framework panes: Router (shown route, params, loader data, layout chain, navigations), i18n (locale,
// direction, catalogs, fallbacks, missing keys) and Forms (each live form's values, issues, touched /
// dirty fields, submit and autosave state). Data comes from the libraries' development hooks.
import { For } from "@rivetjs/runtime/dom";
import { formsInfo, i18nInfo, loadPane, routerInfo } from "./store.ts";
import { ValueTree } from "./parts.tsx";
import { CompLink, Section } from "./components.tsx";
import type { NavigationEntry } from "../protocol.ts";

const path = (href: string | null) => {
  if (!href) return "—";
  try {
    const url = new URL(href);
    return url.pathname + url.search + url.hash;
  } catch {
    return href;
  }
};
const ms = (n: number | null) => (n === null ? "—" : n.toFixed(0) + " ms");
function Field(props: { label: string; value: string; cls?: string }) {
  return (
    <div class={"field " + (props.cls ?? "")}>
      <span class="muted">{props.label}</span> <code class="value">{props.value}</code>
    </div>
  );
}

function Navigations(props: { list: NavigationEntry[] }) {
  return (
    <table class="counts navs">
      <thead>
        <tr>
          <th>To</th>
          <th>From</th>
          <th>Type</th>
          <th>Trigger</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        <For each={() => props.list} by={(n) => n}>
          {(n) => (
            <tr>
              <td>{path(n().to)}</td>
              <td>{path(n().from)}</td>
              <td>{n().type}</td>
              <td>{n().trigger}</td>
              <td class="n">{ms(n().ms)}</td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}

export function RouterPane() {
  return (
    <div class="pane router-pane">
      <div class="toolbar">
        <button type="button" onClick={() => void loadPane("router")}>
          Refresh
        </button>
      </div>
      {() => {
        const info = routerInfo();
        if (!info) return <p class="muted">No router data: the page does not use @rivetjs/router (or its development entry did not load).</p>;
        return (
          <div>
            <Section title="Route">
              {info.route ? (
                <div class="route" data-pattern={info.route.pattern}>
                  <Field label="route" value={info.route.pattern} cls="route-id" />
                  <Field label="url" value={path(info.route.url)} />
                  <Field label="params" value={JSON.stringify(info.route.params)} cls="params" />
                  <Field label="load" value={ms(info.loadMs)} />
                  {info.error ? <p class="error">{info.error}</p> : null}
                </div>
              ) : (
                <p class="muted">No route loaded yet.</p>
              )}
            </Section>
            <Section title="Layout chain">
              <p class="chain layouts">
                <For each={() => info.layouts} by={(id) => id}>
                  {(id) => <code class="layout-id">{id()}</code>}
                </For>
                <code class="layout-id page">page</code>
              </p>
            </Section>
            <Section title="Loader data">
              <ul class="list loader-data">
                <For each={() => info.data} by={(d) => d.id}>
                  {(d) => (
                    <li data-id={d().id}>
                      <span class="name">{d().id}</span> <ValueTree value={() => d().value} id={"loader:" + d().id} />
                    </li>
                  )}
                </For>
              </ul>
              {info.data.length ? <span /> : <p class="muted">None.</p>}
            </Section>
            <Section title="Pending navigation">
              {info.pending ? (
                <p class="pending">
                  {path(info.pending.to) + " (" + info.pending.type + ", " + info.pending.trigger + ", " + info.pending.state + ", " + ms(info.pending.ms) + ")"}
                </p>
              ) : (
                <p class="muted">Idle.</p>
              )}
            </Section>
            <Section title="Last navigations">{info.history.length ? <Navigations list={info.history} /> : <p class="muted">None since the page loaded.</p>}</Section>
          </div>
        );
      }}
    </div>
  );
}

export function I18nPane() {
  return (
    <div class="pane i18n-pane">
      <div class="toolbar">
        <button type="button" onClick={() => void loadPane("i18n")}>
          Refresh
        </button>
      </div>
      {() => {
        const info = i18nInfo();
        if (!info) return <p class="muted">No i18n data: the dev server has no i18n() plugin.</p>;
        return (
          <div>
            <Section title="Locale">
              <Field label="locale" value={info.locale} cls="locale" />
              <Field label="dir" value={info.dir} cls="dir" />
              <Field label="default" value={info.defaultLocale} />
              <Field label="locales" value={info.locales.join(", ")} />
            </Section>
            <Section title="Catalogs">
              <table class="counts catalogs">
                <thead>
                  <tr>
                    <th>Locale</th>
                    <th>File</th>
                    <th>Keys</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={() => info.catalogs} by={(c) => c.locale}>
                    {(c) => (
                      <tr data-locale={c().locale}>
                        <td>{c().locale}</td>
                        <td>{c().file ?? "(loader)"}</td>
                        <td class="n">{String(c().keys)}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </Section>
            <Section title="Missing keys this session">
              {info.missing.length ? (
                <ul class="list missing">
                  <For each={() => info.missing} by={(m) => m.key}>
                    {(m) => (
                      <li data-key={m().key}>
                        <code class="value">{m().key}</code> <span class="muted">{"× " + m().count}</span>
                      </li>
                    )}
                  </For>
                </ul>
              ) : (
                <p class="muted">None.</p>
              )}
            </Section>
            <Section title="Fallbacks (keys a locale lacks)">
              {info.fallbacks.length ? (
                <ul class="list fallbacks">
                  <For each={() => info.fallbacks} by={(f) => f}>
                    {(f) => <li><code class="value">{f()}</code></li>}
                  </For>
                </ul>
              ) : (
                <p class="muted">None.</p>
              )}
            </Section>
          </div>
        );
      }}
    </div>
  );
}

const flags = (form: { submitting: boolean; submitted: boolean; validating: boolean; enhanced: boolean }) =>
  [form.submitting && "submitting", form.submitted && "submitted", form.validating && "validating", form.enhanced && "enhanced"].filter(Boolean).join(", ") || "idle";

export function FormsPane() {
  return (
    <div class="pane forms-pane">
      {() =>
        formsInfo().length ? (
          <ul class="list forms">
            <For each={formsInfo} by={(f) => f.id}>
              {(f) => (
                <li class="form" data-form={f().id}>
                  <header>
                    <h2>{"#" + f().id}</h2>
                    <span class="muted">{f().name}</span>
                    {() => (f().component ? <CompLink comp={f().component!} /> : null)}
                    {() => (f().mounted ? null : <span class="badge">not in the document</span>)}
                  </header>
                  {() => (f().autosaveOnly ? null : <Field label="state" value={flags(f()) + " · submits " + f().submitCount} cls="state" />)}
                  {() =>
                    f().autosaveOnly ? null : (
                      <div class="field values">
                        <span class="muted">values</span> <ValueTree value={() => f().values} id={"form:" + f().id} />
                      </div>
                    )
                  }
                  {() => (f().autosaveOnly ? null : <Field label="touched" value={f().touched.join(", ") || "—"} cls="touched" />)}
                  {() => (f().autosaveOnly ? null : <Field label="dirty" value={f().dirty.join(", ") || "—"} cls="dirty" />)}
                  {() =>
                    f().autosaveOnly ? null : f().errors.length || f().formErrors.length ? (
                      <ul class="list issues">
                        <For each={() => f().errors} by={(e) => e.path}>
                          {(e) => (
                            <li data-path={e().path}>
                              <span class="name">{e().path}</span> <span class="error">{e().issues.join("; ")}</span>
                            </li>
                          )}
                        </For>
                        <For each={() => f().formErrors} by={(e) => e}>
                          {(e) => (
                            <li data-path="">
                              <span class="name">form</span> <span class="error">{e()}</span>
                            </li>
                          )}
                        </For>
                      </ul>
                    ) : (
                      <Field label="issues" value="none" cls="no-issues" />
                    )
                  }
                  {() => {
                    const a = f().autosave;
                    if (!a) return null;
                    return (
                      <Field
                        label="autosave"
                        value={a.status + (a.version !== undefined ? " · v" + a.version : "") + " · " + a.unsavedFields + " unsaved" + (a.error ? " · " + a.error : "") + (a.conflict !== undefined ? " · conflict with v" + a.conflict : "")}
                        cls="autosave"
                      />
                    );
                  }}
                </li>
              )}
            </For>
          </ul>
        ) : (
          <p class="muted">No live forms (createForm from @rivetjs/forms).</p>
        )
      }
    </div>
  );
}
