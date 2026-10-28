import type { RealPage } from "./contract.ts";

export const realLanes = ["rivet", "solid-stable", "solid", "qwik-stable", "qwik"] as const;
export type RealLane = (typeof realLanes)[number];
export const fields = [
  "Display name",
  "Email",
  "Company",
  "Role",
  "Phone",
  "Address",
  "City",
  "Region",
  "Postal code",
  "Country",
  "Timezone",
  "Language",
  "Website",
  "Biography",
  "Team",
];
export const headings = [
  "Introduction",
  "Installation",
  "Configuration",
  "Routing",
  "Data loading",
  "Components",
  "State",
  "Forms",
  "Accessibility",
  "Testing",
  "Deployment",
  "Troubleshooting",
];
export function serverData(page: RealPage) {
  if (page === "products")
    return Array.from({ length: 96 }, (_, i) => ({
      id: i + 1,
      name: ["Desk lamp", "Travel bag", "Notebook", "Headphones"][i % 4] + " " + (i + 1),
      category: ["home", "travel", "office"][i % 3],
      price: 20 + i,
      detail: "Thoughtfully designed for everyday use. Durable materials, two year warranty.",
    }));
  if (page === "dashboard")
    return Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      name: "Project " + String(i + 1).padStart(3, "0"),
      owner: ["Alex Chen", "Sam Rivera", "Morgan Lee"][i % 3],
      status: i % 2 ? "In progress" : "Completed",
      revenue: 1200 + i * 75,
    }));
  return [];
}
export const css = `*{box-sizing:border-box}body{margin:0;background:#f5f7fa;color:#182538;font:16px/1.5 system-ui,sans-serif}header,main,footer{max-width:1200px;margin:auto;padding:24px}header{display:flex;align-items:center;justify-content:space-between;background:white;border-bottom:1px solid #d8dfe8}nav,.controls,.pagination,.kpis{display:flex;gap:12px;align-items:center;flex-wrap:wrap}a{color:#2354ab}button,input,select{font:inherit;padding:9px 12px;border:1px solid #acb8c8;border-radius:5px;background:white;color:inherit}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}button[aria-pressed=true],button[aria-selected=true]{background:#2354ab;color:white}h1{font-size:32px;margin:0 0 8px}h2{font-size:22px}label{display:grid;gap:6px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:24px 0}.product,.kpi,.panel{padding:20px;background:white;border:1px solid #d8dfe8;border-radius:8px}.product-image{height:100px;background:#e3eafa;display:grid;place-items:center}.product h2{font-size:18px}.product button{width:100%}.kpi{flex:1}.kpi strong{display:block;font-size:26px}table{width:100%;border-collapse:collapse;background:white;margin:24px 0}th,td{text-align:left;padding:12px;border-bottom:1px solid #d8dfe8}.form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin:24px 0}.error{color:#a21c27;min-height:24px;font-size:14px}[aria-invalid=true]{border-color:#a21c27}.overlay{position:fixed;inset:0;background:#17243b66;display:grid;place-items:center;z-index:5}.dialog{width:560px;max-width:95vw;max-height:85vh;overflow:auto;background:white;padding:28px;border-radius:10px}.docs{display:grid;grid-template-columns:200px 1fr;gap:32px}.docs aside{position:sticky;top:16px;align-self:start}.docs nav{display:grid}.doc-section{scroll-margin-top:20px;margin-bottom:48px}.doc-section p{max-width:75ch}pre{overflow:auto;background:#182538;color:#f3f6ff;padding:20px;border-radius:6px}footer{border-top:1px solid #d8dfe8}.toggle{display:flex;gap:12px;margin:16px 0}@media(max-width:700px){.grid,.form-grid{grid-template-columns:repeat(2,1fr)}.docs{grid-template-columns:1fr}}`;

/** Canonical markup; adapters change only native state/list/event syntax. No handwritten DOM. */
export function appSource(lane: RealLane, page: RealPage) {
  const qwik = lane.startsWith("qwik");
  const rivet = lane === "rivet";
  const read = (name: string) => (qwik ? `${name}.value` : `${name}()`);
  const write = (name: string, value: string) => (qwik ? `${name}.value = ${value}` : rivet ? `${name}.set(${value})` : `set_${name}(${value})`);
  const state = (name: string, value: string) =>
    qwik ? `const ${name} = useSignal(${value});` : rivet ? `const ${name} = signal(${value});` : `const [${name}, set_${name}] = createSignal(${value});`;
  const memo = (name: string, value: string) => `const ${name} = ${qwik ? "useComputed$" : rivet ? "computed" : "createMemo"}(() => ${value});`;
  // Qwik handlers run async (resumed): `currentTarget` is passed as the second argument and default
  // prevention is declarative (`preventdefault:submit`); the handler body is otherwise identical.
  const event = (name: string, body: string, param = "") =>
    qwik
      ? `${name === "onSubmit" ? "preventdefault:submit " : ""}${name}$={(${param ? param + ", element" : ""}) => { ${body.replaceAll("e.currentTarget", "element").replace("e.preventDefault(); ", "")} }}`
      : `${name}={(${param}) => { ${body} }}`;
  const loop = (expr: string, body: string) =>
    qwik
      ? `{(${expr}).map((item) => (${body}))}`
      : `<For each={${rivet ? `() => ${expr}` : expr}}${rivet ? " by={(item) => item.id}" : ""}>{(item) => (${rivet ? body.replaceAll("item.", "item().") : body})}</For>`;
  const key = qwik ? " key={item.id}" : "";
  const r = read;
  let declarations = "";
  let body = "";
  let extraHeader = "";
  if (page === "products") {
    declarations = [
      state("cart", "0"),
      state("query", '""'),
      state("category", '"all"'),
      state("sort", '"featured"'),
      state("current", "1"),
      memo(
        "filtered",
        `{const q = ${r("query")}.toLowerCase(); const rows = props.data.filter(item => (${r("category")} === "all" || item.category === ${r("category")}) && (!q || item.name.toLowerCase().includes(q))); if (${r("sort")} !== "featured") rows.sort((a,b) => ${r("sort")} === "price-asc" ? a.price-b.price : b.price-a.price); return rows;}`,
      ),
      memo("visible", `${r("filtered")}.slice((${r("current")}-1)*48, ${r("current")}*48)`),
    ].join("\n");
    extraHeader = `<span>Cart <output id="cart-count" aria-live="polite">{${r("cart")}}</output></span>`;
    body = `<h1>Everyday essentials</h1><p>Useful products for home, work and your next adventure.</p><div class="controls"><label>Search products<input id="search" type="search" value={${r("query")}} ${event("onInput", `${write("query", "e.currentTarget.value")}; ${write("current", "1")};`, "e")} /></label><label>Sort by<select id="sort" value={${r("sort")}} ${event("onChange", `${write("sort", "e.currentTarget.value")}; ${write("current", "1")};`, "e")}><option value="featured">Featured</option><option value="price-asc">Price ascending</option><option value="price-desc">Price descending</option></select></label></div><nav aria-label="Product category">${["all", "home", "travel", "office"].map((c) => `<button id="chip-${c}" aria-pressed={${r("category")} === "${c}"} ${event("onClick", `${write("category", JSON.stringify(c))}; ${write("current", "1")};`)}>${c}</button>`).join("")}</nav><p><output id="result-count">{${r("filtered")}.length}</output> products</p><div class="grid">${loop(r("visible"), `<article class="product" data-id={item.id}${key}><div class="product-image" role="img" aria-label={item.name}>{item.category}</div><h2>{item.name}</h2><p>{item.detail}</p><p><strong>{"$" + item.price}</strong> <span>In stock</span></p><button class="add-cart" ${event("onClick", `${write("cart", `${r("cart")} + 1`)};`)}>Add to cart</button></article>`)}</div>${pagination(r, write, event, `${r("current")}*48 >= ${r("filtered")}.length`)}`;
  } else if (page === "dashboard") {
    declarations = [
      state("descending", "false"),
      state("current", "1"),
      state("tab", '"overview"'),
      state("menu", "false"),
      state("status", '"Ready"'),
      state("from", '"2026-10-01"'),
      state("to", '"2026-10-28"'),
      memo("visible", `[...props.data].sort((a,b) => ${r("descending")} ? b.id-a.id : a.id-b.id).slice((${r("current")}-1)*50, ${r("current")}*50)`),
    ].join("\n");
    body = `<h1>Workspace overview</h1><p>Projects, delivery and team performance.</p><div class="kpis">${["Revenue|$184,200", "Projects|100", "Team members|24", "Completion rate|94%"].map((t) => `<section class="kpi"><h2>${t.split("|")[0]}</h2><strong>${t.split("|")[1]}</strong><p>Compared with last month</p></section>`).join("")}</div><div class="controls"><label>From<input id="date-from" type="date" value={${r("from")}} ${event("onInput", `${write("from", "e.currentTarget.value")};`, "e")} /></label><label>To<input id="date-to" type="date" value={${r("to")}} ${event("onInput", `${write("to", "e.currentTarget.value")};`, "e")} /></label><output id="date-summary">{${r("from")} + " to " + ${r("to")}}</output><button id="menu-toggle" aria-expanded={${r("menu")}} ${event("onClick", `${write("menu", `!${r("menu")}`)};`)}>Actions</button>{${r("menu")} ? <div role="menu"><button id="export" role="menuitem" ${event("onClick", `${write("menu", "false")}; ${write("status", '"Export prepared"')};`)}>Prepare export</button></div> : null}</div><div role="tablist">${["overview", "activity"].map((t) => `<button id="tab-${t}" role="tab" aria-selected={${r("tab")} === "${t}"} ${event("onClick", `${write("tab", JSON.stringify(t))};`)}>${t}</button>`).join("")}</div><p id="tab-content" role="tabpanel">{${r("tab")} === "overview" ? "All workspace projects" : "Recent activity: 12 projects delivered"}</p><table><thead><tr><th><button id="sort-table" ${event("onClick", `${write("descending", `!${r("descending")}`)}; ${write("current", "1")};`)}>Project <span id="sort-state">{${r("descending")} ? "Descending" : "Ascending"}</span></button></th><th>Owner</th><th>Status</th><th>Revenue</th></tr></thead><tbody>${loop(r("visible"), `<tr data-id={item.id}${key}><td><a href={"#project-" + item.id}>{item.name}</a></td><td>{item.owner}</td><td>{item.status}</td><td>{"$" + item.revenue}</td></tr>`)}</tbody></table>${pagination(r, write, event, `${r("current")}*50 >= props.data.length`)}<output id="dashboard-status" aria-live="polite">{${r("status")}}</output>`;
  } else if (page === "settings") {
    declarations = [
      state("values", 'Array(15).fill("")'),
      state("submitted", "false"),
      state("notifications", "true"),
      state("publicProfile", "false"),
      state("modal", "false"),
      state("status", '"Unsaved changes"'),
      memo("invalid", `${r("values")}.map((value, index) => value.trim().length < 2 || (index === 1 && !/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(value)))`),
    ].join("\n");
    body = `<h1>Account settings</h1><p>Manage your profile, workspace details and communication preferences.</p><form novalidate ${event("onSubmit", `e.preventDefault(); ${write("submitted", "true")}; const errors = ${r("invalid")}.filter(Boolean).length; ${write("status", 'errors ? "Please correct " + errors + " fields" : "Review your changes"')}; ${write("modal", "errors === 0")};`, "e")}><div class="form-grid">${fields.map((f, i) => `<label for="field-${i}">${f}<input id="field-${i}" name="field-${i}" type="${i === 1 ? "email" : "text"}" value={${r("values")}[${i}]} aria-invalid={${r("submitted")} && ${r("invalid")}[${i}]} aria-describedby="error-${i}" ${event("onInput", `const next = [...${r("values")}]; next[${i}] = e.currentTarget.value; ${write("values", "next")};`, "e")} /><span id="error-${i}" class="error">{${r("submitted")} && ${r("invalid")}[${i}] ? "${i === 1 ? "Enter a valid email" : "Use at least two characters"}" : ""}</span></label>`).join("")}</div>${[
      ["notifications", "Email notifications"],
      ["publicProfile", "Public profile"],
    ]
      .map(
        ([s, label]) =>
          `<label class="toggle"><input id="${s}" type="checkbox" checked={${r(s)}} ${event("onChange", `${write(s, "e.currentTarget.checked")};`, "e")} />${label}</label>`,
      )
      .join(
        "",
      )}<button id="save" type="submit">Save changes</button><p id="form-status" role="status">{${r("status")}}</p></form>{${r("modal")} ? <div class="overlay"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">Confirm settings</h2><p>Save these changes to your account?</p><button id="cancel" ${event("onClick", `${write("modal", "false")};`)}>Cancel</button><button id="confirm" ${event("onClick", `${write("status", '"Settings saved"')}; ${write("modal", "false")};`)}>Confirm</button></section></div> : null}`;
  } else {
    declarations = [state("open", "false"), state("query", '""'), state("copied", '""')].join("\n");
    body = `<h1>Workspace developer guide</h1><p>Practical guidance for shipping accessible, dependable applications.</p><button id="open-search" ${event("onClick", `${write("open", "true")};`)}>Search documentation</button><div class="docs"><aside id="toc"><h2>On this page</h2><nav aria-label="Table of contents">${headings.map((h, i) => `<a href="#section-${i}">${h}</a>`).join("")}</nav></aside><article>${headings.map((h, i) => `<section class="doc-section" id="section-${i}"><h2>${h}</h2>${Array.from({ length: 4 }, (_, j) => `<p>${h} starts with a clear contract between the server, browser and the people using your application. Keep data ownership explicit and provide useful feedback while work is in progress. This guide describes step ${j + 1} with practical checks for a production workspace, including keyboard access, loading states and recoverable errors.</p>`).join("")}<h3>Example ${i + 1}</h3><pre><code>{"const workspace = createWorkspace();\\nworkspace.start();"}</code></pre><button id="copy-${i}" ${event("onClick", `navigator.clipboard.writeText("const workspace = createWorkspace();\\nworkspace.start();").then(${qwik ? "() =>" : "() =>"} { ${write("copied", JSON.stringify("Copied example " + (i + 1)))}; });`)}>Copy code</button></section>`).join("")}</article></div><output id="copy-status" aria-live="polite">{${r("copied")}}</output>{${r("open")} ? <div class="overlay"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">Search documentation</h2><label>Search<input id="doc-search" type="search" value={${r("query")}} ${event("onInput", `${write("query", "e.currentTarget.value")};`, "e")} /></label><nav id="search-results">${headings.map((h, i) => `{"${h.toLowerCase()}".includes(${r("query")}.toLowerCase()) ? <a href="#section-${i}" ${event("onClick", `${write("open", "false")};`)}>${h}</a> : null}`).join("")}</nav><button id="close-search" ${event("onClick", `${write("open", "false")};`)}>Close search</button></section></div> : null}`;
  }
  // Boolean ARIA states render as explicit "true" / "false" in every lane (Solid omits false booleans).
  body = body.replace(/aria-(pressed|selected|expanded|invalid)=\{([^}]+)\}/g, (_, name, expression) => `aria-${name}={(${expression}) ? "true" : "false"}`);
  const imports = qwik
    ? `import { component$, useSignal, useComputed$ } from "${lane === "qwik" ? "@qwik.dev/core" : "@builder.io/qwik"}";`
    : rivet
      ? 'import { signal, computed } from "@rivetjs/reactivity"; import { For } from "@rivetjs/runtime/dom";'
      : 'import { createSignal, createMemo, For } from "solid-js";';
  return `${imports}\nexport ${qwik ? "const App = component$((props: {data: any[]}) =>" : "function App(props: {data: any[]})"} {\n${declarations}\nreturn <div id="real-page"><header><a href="#home">Northstar workspace</a><nav aria-label="Main"><a href="#catalog">Catalog</a><a href="#workspace">Workspace</a><a href="#support">Support</a></nav>${extraHeader}</header><main>${body}</main><footer><p>Northstar workspace · Built for everyday work</p><a href="#privacy">Privacy</a> <a href="#contact">Contact</a></footer></div>;\n}${qwik ? ");" : ""}\n`;
}
function pagination(read: (n: string) => string, write: (n: string, v: string) => string, event: (n: string, b: string, p?: string) => string, end: string) {
  return `<nav class="pagination" aria-label="Pagination"><button id="previous" disabled={${read("current")} <= 1} ${event("onClick", `${write("current", `${read("current")} - 1`)};`)}>Previous</button><span>Page <output id="page-number">{${read("current")}}</output></span><button id="next" disabled={${end}} ${event("onClick", `${write("current", `${read("current")} + 1`)};`)}>Next</button></nav>`;
}
