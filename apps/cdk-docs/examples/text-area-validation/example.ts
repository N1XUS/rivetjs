import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextArea validation",
  summary: "TextArea validation: isRequired and minLength (native), a server error from Form, and a realtime aria validate function, each with a FieldError.",
  tags: ["text-area", "validation", "forms"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#ta-why", "required", ""] },
    { attr: ["#ta-why", "minlength", "10"] },
    { absent: "#ta-why-error" },
    { attr: ["#ta-address", "aria-invalid", "true"] },
    { described: ["#ta-address", "We cannot deliver there."] },
    { attr: ["#ta-tweet", "aria-invalid", "true"] },
    { expect: ["#ta-tweet-error", "Too long by 4."] },
    // Submit: the empty required textarea blocks it and shows the browser message.
    { click: "#ta-send" },
    { matches: "#ta-why-error" },
    { focused: "#ta-why" },
  ],
});
