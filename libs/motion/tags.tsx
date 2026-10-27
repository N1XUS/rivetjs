// `<Motion.<tag>>`: one component per tag (`index.tsx` exports this module as the `Motion` namespace, so a bundle
// carries only the tags it uses). Each tag is its own module (`tags/<tag>.tsx`, the same compiled element over
// `motionElement`, element.tsx): a literal tag, so the compiler records its spread, attribute bindings and handlers as
// resume sites (`Dynamic` props are not). The tags are components (PascalCase, renamed here): an element with gestures
// is a conditional boundary with its own record (the explicit `onPointerEnter`: STATIC-ZERO T3 `listens`), and the
// client build emits one chunk per module holding boundaries, so one module per tag keeps a page's chunks to the tags
// it renders (CTX-SOUND 2026-10-27; one module of 60 tags: +26 KB min fetched ahead per gesture page).
// `m.bind` (one spread) carries the ref and the handlers of the gesture groups present at creation: no attribute
// slot per absent handler (the server renderer pays per slot; its spread skips `ref` / `on*` by name).
// `entrance` (client-render entrance rules, css.ts) comes from the tag modules, not element.tsx: a resumed page's gesture
// handlers load element.tsx's graph only. Add a tag: a `tags/<tag>.tsx` (same body; void elements take no children) and
// its line here.
export { A as a } from "./tags/a.tsx";
export { Article as article } from "./tags/article.tsx";
export { Aside as aside } from "./tags/aside.tsx";
export { B as b } from "./tags/b.tsx";
export { Blockquote as blockquote } from "./tags/blockquote.tsx";
export { Button as button } from "./tags/button.tsx";
export { Code as code } from "./tags/code.tsx";
export { Dd as dd } from "./tags/dd.tsx";
export { Details as details } from "./tags/details.tsx";
export { Div as div } from "./tags/div.tsx";
export { Dl as dl } from "./tags/dl.tsx";
export { Dt as dt } from "./tags/dt.tsx";
export { Em as em } from "./tags/em.tsx";
export { Figcaption as figcaption } from "./tags/figcaption.tsx";
export { Figure as figure } from "./tags/figure.tsx";
export { Footer as footer } from "./tags/footer.tsx";
export { Form as form } from "./tags/form.tsx";
export { H1 as h1 } from "./tags/h1.tsx";
export { H2 as h2 } from "./tags/h2.tsx";
export { H3 as h3 } from "./tags/h3.tsx";
export { H4 as h4 } from "./tags/h4.tsx";
export { H5 as h5 } from "./tags/h5.tsx";
export { H6 as h6 } from "./tags/h6.tsx";
export { Header as header } from "./tags/header.tsx";
export { Hr as hr } from "./tags/hr.tsx";
export { I as i } from "./tags/i.tsx";
export { Img as img } from "./tags/img.tsx";
export { Input as input } from "./tags/input.tsx";
export { Label as label } from "./tags/label.tsx";
export { Li as li } from "./tags/li.tsx";
export { Main as main } from "./tags/main.tsx";
export { Nav as nav } from "./tags/nav.tsx";
export { Ol as ol } from "./tags/ol.tsx";
export { P as p } from "./tags/p.tsx";
export { Pre as pre } from "./tags/pre.tsx";
export { Section as section } from "./tags/section.tsx";
export { Select as select } from "./tags/select.tsx";
export { Small as small } from "./tags/small.tsx";
export { Span as span } from "./tags/span.tsx";
export { Strong as strong } from "./tags/strong.tsx";
export { Summary as summary } from "./tags/summary.tsx";
export { Table as table } from "./tags/table.tsx";
export { Tbody as tbody } from "./tags/tbody.tsx";
export { Td as td } from "./tags/td.tsx";
export { Textarea as textarea } from "./tags/textarea.tsx";
export { Th as th } from "./tags/th.tsx";
export { Thead as thead } from "./tags/thead.tsx";
export { Tr as tr } from "./tags/tr.tsx";
export { Ul as ul } from "./tags/ul.tsx";
export { Video as video } from "./tags/video.tsx";
export { Svg as svg } from "./tags/svg.tsx";
export { G as g } from "./tags/g.tsx";
export { Path as path } from "./tags/path.tsx";
export { Circle as circle } from "./tags/circle.tsx";
export { Rect as rect } from "./tags/rect.tsx";
export { Line as line } from "./tags/line.tsx";
export { Polyline as polyline } from "./tags/polyline.tsx";
export { Polygon as polygon } from "./tags/polygon.tsx";
export { Ellipse as ellipse } from "./tags/ellipse.tsx";
export { Text as text } from "./tags/text.tsx";
