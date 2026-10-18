// Spike S2: the route's derived slice — what a compiler would emit for page.tsx of the rivet lane: per-site handlers,
// per-signal edit lists, the row writer parameterised by row, structural edits (branch, list reconcile, route swap)
// done against the existing nodes. No framework runtime, no component run, no reactive graph. Values come from the
// page's values tail (`boot`), never from re-executing the page.
const $ = (s) => document.querySelector(s);
let items, v, byId, section, ul, main, detailMod, routed;

export function boot(values) {
  items = values.items;
  v = values.v; // keyed body signals: count, open, query, picked, scrolled
  main = $("main");
  section = $("main > section");
  ul = $("#rows");
}

// --- signal edit lists (static readers of each keyed signal) ---------------------------------------------------------
const write = {
  count() {
    $("#count").textContent = v.count;
    const b = $("#open b");
    if (b) b.textContent = v.count;
  },
  open() {
    const panel = $("#panel");
    const p = document.createElement("p");
    if (v.open) {
      p.id = "open";
      p.append("open ");
      const b = document.createElement("b");
      b.textContent = v.count;
      p.append(b);
    } else {
      p.id = "closed";
      p.textContent = "closed";
    }
    panel.replaceChildren(p);
  },
  scrolled() {
    $("#scrolled").textContent = v.scrolled ? "scrolled" : "top";
  },
  picked(prev) {
    rows();
    if (prev && byId[prev]) byId[prev].className = "row";
    if (byId[v.picked]) byId[v.picked].className = "row sel";
  },
  query() {
    rows();
    // Same filter as every lane (FIXTURE.md).
    const q = v.query.toLowerCase();
    const list = q ? items.filter((item) => item.label.toLowerCase().includes(q)) : items;
    // keyed reconcile fast path: an unchanged list touches nothing (a later key with the same result set)
    const kids = ul.children;
    if (kids.length === list.length) {
      let i = 0;
      while (i < list.length && kids[i] === byId[list[i].id]) i++;
      if (i === list.length) return;
    }
    ul.replaceChildren(...list.map((item) => byId[item.id]));
  },
};

// Lazy O(1) list adoption: rows are the server's <li>s, keyed by data-id, materialised on first need.
function rows() {
  if (byId) return;
  byId = Object.create(null);
  for (const li of ul.children) byId[li.dataset.id] = li;
}

// --- handlers (sites) -----------------------------------------------------------------------------------------------
const sites = {
  inc() {
    v.count++;
    write.count();
  },
  toggle() {
    v.open = !v.open;
    write.open();
  },
  pick(li) {
    const prev = v.picked;
    v.picked = +li.dataset.id;
    write.picked(prev);
  },
  filter(value) {
    v.query = value;
    write.query();
  },
  scroll() {
    const s = scrollY > 100;
    if (s !== v.scrolled) {
      v.scrolled = s;
      write.scrolled();
    }
  },
};

export function dispatch(e) {
  const t = e.target;
  if (e.type === "scroll") return sites.scroll();
  if (e.type === "input") return t.id === "filter" && sites.filter(t.value);
  // click
  if (t.closest("#inc")) return sites.inc();
  if (t.closest("#toggle")) return sites.toggle();
  const pick = t.closest(".pick");
  if (pick) return sites.pick(pick.closest("li"));
  const a = t.closest("a[href]");
  if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
    e.preventDefault();
    navigate(a.getAttribute("href"));
  }
}

/** A held cold event: [type, target, value at dispatch]. */
export function replay([type, target, value]) {
  if (type === "scroll") return sites.scroll();
  if (type === "input") return target.id === "filter" && sites.filter(value);
  if (target.closest("#inc")) return sites.inc();
  if (target.closest("#toggle")) return sites.toggle();
  const pick = target.closest(".pick");
  if (pick) return sites.pick(pick.closest("li"));
  const a = target.closest("a[href]");
  if (a) navigate(a.getAttribute("href"));
}

// --- routes: the list section is kept alive across navigations (filter + selection survive) ------------------------
function navigate(href) {
  history.pushState(null, "", href);
  route();
}

export async function route() {
  const path = location.pathname;
  if (path === routed) return;
  routed = path;
  const m = /^\/item\/(\d+)$/.exec(path);
  const current = main.querySelector("#detail, #missing") || section;
  if (!m) {
    if (current !== section) main.replaceChild(section, current);
  } else {
    detailMod ||= await import("/detail.js");
    const item = items.find((i) => String(i.id) === m[1]);
    const next = item ? detailMod.detail(item) : detailMod.missing();
    main.replaceChild(next, main.querySelector("#detail, #missing") || section);
  }
  import("/a.js").then((a) => a.pageview(path));
}

// --- client-only effect (visible) ------------------------------------------------------------------------------------
export function chart() {
  const canvas = $("#chart");
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0f766e";
  for (let i = 0; i < 10; i++) ctx.fillRect(i * 30, 150 - items[i].id * 10, 24, items[i].id * 10);
  canvas.dataset.drawn = "1";
}
