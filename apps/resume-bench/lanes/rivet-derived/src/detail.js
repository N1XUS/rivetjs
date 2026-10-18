// Spike S2: the lazily loaded detail route (rendered layer: new content, created from a template).
const tpl = document.createElement("template");
tpl.innerHTML = '<article id="detail"><h2></h2><a id="back" href="/">back</a></article>';

export function detail(item) {
  const el = tpl.content.firstChild.cloneNode(true);
  el.firstChild.textContent = item.label;
  return el;
}

export function missing() {
  const p = document.createElement("p");
  p.id = "missing";
  p.textContent = "missing";
  return p;
}
