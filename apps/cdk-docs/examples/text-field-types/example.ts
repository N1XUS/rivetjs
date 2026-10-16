import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextField input options",
  summary:
    "Field props forwarded to the native input (type, autoComplete, inputMode, enterKeyHint, maxLength, minLength, pattern, spellCheck), placeholder on Input.",
  tags: ["text-field", "options"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#tf-email", "type", "email"] },
    { attr: ["#tf-email", "autocomplete", "email"] },
    { attr: ["#tf-search", "type", "search"] },
    { attr: ["#tf-search", "enterkeyhint", "search"] },
    { attr: ["#tf-pin", "inputmode", "numeric"] },
    { attr: ["#tf-pin", "maxlength", "4"] },
    { attr: ["#tf-pin", "pattern", "[0-9]{4}"] },
    { attr: ["#tf-pass", "type", "password"] },
    { attr: ["#tf-handle", "spellcheck", "false"] },
    { attr: ["#tf-handle", "placeholder", "@ada"] },
    { fill: ["#tf-pin", "1234"] },
    { attr: ["#tf-pin", "value", "1234"] },
  ],
});
