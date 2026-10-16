import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Controlled and uncontrolled CheckboxGroup",
  summary: "A CheckboxGroup with value as a two-way signal of the checked values (also written from buttons) next to an uncontrolled group with defaultValue.",
  tags: ["checkbox-group", "state"],
  status: "experimental",
  frame: { height: 342, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#toppings", "role", "group"] },
    { name: ["#toppings", "Toppings"] },
    { described: ["#toppings", "Pick any."] },
    { matches: '#toppings input[value="cheese"][name="toppings"]:checked' },
    { click: 'label:has(input[value="olives"])' },
    { expect: ["#picked", "cheese, olives"] },
    { click: "#none" },
    { expect: ["#picked", "nothing"] },
    { matches: 'input[value="cheese"]:not(:checked)' },
    { click: "#all" },
    { matches: 'input[value="ham"]:checked' },
    { expect: ["#picked", "cheese, ham, olives"] },
    { matches: '#sides input[value="fries"]:checked' },
    { click: '#sides label:has(input[value="salad"])' },
    { matches: '#sides label[data-selected]:has(input[value="salad"])' },
  ],
});
