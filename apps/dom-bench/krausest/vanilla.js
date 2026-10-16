// Hand-written DOM baseline for the krausest-style suite (keyed): template cloning, direct
// firstChild/nextSibling navigation, one delegated click listener, manual keyed bookkeeping.
// It plays the role of js-framework-benchmark's vanillajs-keyed: the denominator of every ratio.
import { label } from "./words.js";

let nextId = 1;
let rows = []; // { id, label, tr, text }
let selected = null;
const tbody = document.getElementById("tbody");
const template = document.createElement("template");
template.innerHTML =
  '<tr><td class="col-md-1"> </td><td class="col-md-4"><a> </a></td><td class="col-md-1"><a><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></a></td><td class="col-md-6"></td></tr>';
const prototype = template.content.firstChild;

function build(count) {
  const out = new Array(count);
  for (let i = 0; i < count; i++) {
    const row = { id: nextId++, label: label(), tr: null, text: null };
    const tr = prototype.cloneNode(true),
      first = tr.firstChild,
      a = first.nextSibling.firstChild;
    first.firstChild.nodeValue = row.id;
    a.firstChild.nodeValue = row.label;
    row.tr = tr;
    row.text = a.firstChild;
    tr.$row = row;
    out[i] = row;
  }
  return out;
}
function append(list) {
  for (let i = 0; i < list.length; i++) tbody.appendChild(list[i].tr);
}
function clear() {
  rows = [];
  selected = null;
  tbody.textContent = "";
}
const actions = {
  run() {
    clear();
    append((rows = build(1000)));
  },
  runlots() {
    clear();
    append((rows = build(10000)));
  },
  add() {
    const added = build(1000);
    rows = rows.concat(added);
    append(added);
  },
  update() {
    for (let i = 0; i < rows.length; i += 10) {
      const row = rows[i];
      row.label += " !!!";
      row.text.nodeValue = row.label;
    }
  },
  clear,
  swaprows() {
    if (rows.length <= 998) return;
    const a = rows[1],
      b = rows[998],
      after = a.tr.nextSibling;
    tbody.insertBefore(a.tr, b.tr.nextSibling);
    tbody.insertBefore(b.tr, after);
    rows[1] = b;
    rows[998] = a;
  },
};
for (const id of Object.keys(actions)) document.getElementById(id).addEventListener("click", actions[id]);
tbody.addEventListener("click", (event) => {
  const a = event.target.closest("a");
  if (!a) return;
  const tr = a.closest("tr"),
    row = tr.$row;
  if (a.parentNode.className === "col-md-4") {
    if (selected) selected.className = "";
    tr.className = "danger";
    selected = tr;
  } else {
    rows.splice(rows.indexOf(row), 1);
    if (selected === tr) selected = null;
    tr.remove();
  }
});
