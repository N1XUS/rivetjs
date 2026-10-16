// Ported from @testing-library/dom (src/event-map.js), MIT, © Kent C. Dodds.
// The event constructor and default `bubbles` / `cancelable` / `composed` of every event type
// `fireEvent` knows, so `fire` matches what a real browser dispatches (focus / blur / mouseenter do
// not bubble, focus is composed, …). Rivet: compacted to one row per constructor + flags
// (1 bubbles, 2 cancelable, 4 composed); additions marked `Rivet:` (types DTL lacks).
const rows = [
  "ClipboardEvent 7 copy cut paste",
  "CompositionEvent 7 compositionend compositionstart compositionupdate",
  "KeyboardEvent 7 keydown keypress keyup",
  "FocusEvent 4 focus blur",
  "FocusEvent 5 focusin focusout",
  "Event 1 change select",
  "InputEvent 5 input",
  "Event 2 invalid",
  "Event 3 submit reset",
  "MouseEvent 7 click contextmenu dblclick mousedown mousemove mouseout mouseover mouseup",
  "DragEvent 7 drag dragenter dragover dragstart drop",
  "DragEvent 5 dragend dragexit dragleave",
  "MouseEvent 4 mouseenter mouseleave",
  "TouchEvent 5 touchcancel",
  "TouchEvent 7 touchend touchmove touchstart",
  "UIEvent 0 resize scroll",
  "WheelEvent 7 wheel",
  "Event 0 abort canplay canplaythrough durationchange emptied encrypted ended loadeddata loadedmetadata pause play playing ratechange seeked seeking stalled suspend timeupdate volumechange waiting load error offline online",
  "ProgressEvent 0 loadstart progress",
  "AnimationEvent 1 animationstart animationend animationiteration",
  "TransitionEvent 1 transitioncancel transitionrun transitionstart",
  "TransitionEvent 3 transitionend",
  "PointerEvent 7 pointerover pointerdown pointermove pointerup pointerout",
  "PointerEvent 0 pointerenter pointerleave",
  "PointerEvent 5 pointercancel gotpointercapture lostpointercapture",
  "PopStateEvent 1 popstate",
  "PageTransitionEvent 3 pagehide pageshow",
  // Rivet: types DTL's map lacks (UI Events / HTML defaults).
  "InputEvent 7 beforeinput",
  "MouseEvent 7 auxclick",
  "Event 1 visibilitychange",
];

/** Event type → [constructor name, `EventInit` defaults]. */
export const eventMap = new Map<string, [string, EventInit]>();
for (const row of rows) {
  const [ctor, flags, ...types] = row.split(" ");
  const bits = +flags!;
  for (const type of types) eventMap.set(type, [ctor!, { bubbles: !!(bits & 1), cancelable: !!(bits & 2), composed: !!(bits & 4) }]);
}
