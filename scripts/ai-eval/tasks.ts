// AI eval tasks: what a model is asked to build in a fresh Rivet starter, and how the result is checked.
// Prompts name the element ids / attributes the behaviour steps use, nothing about how to write Rivet:
// that is what the project's AGENTS.md, skills and the MCP server are for. Each task has a seeded
// reference solution in `reference/<id>/` (same paths as `files`) that passes every check.
import type { Step } from "../../libs/docs-kit/define.ts";

/** Browser step: a docs-kit example `Step`, or one of the eval's own. */
export type EvalStep =
  | Step
  /** Reload the page (state that must survive it: localStorage, server data). */
  | { reload: true }
  /** Resize the viewport (`[width, height]`). */
  | { viewport: [width: number, height: number] }
  /** Wait until exactly `n` elements match the selector. */
  | { count: [selector: string, n: number] };

export interface EvalTask {
  id: string;
  title: string;
  /** Starter the app is created from (`templates/starter-<template>`). */
  template: "static" | "server" | "ui";
  /** What the model is asked to do (Markdown). */
  prompt: string;
  /** Files the model writes, app-relative. All must be present in its output. */
  files: string[];
  /** Page the behaviour steps start on (default `/`). */
  open?: string;
  /** HTTP status of paths before the browser steps (`{ "/products/9": 404 }`). */
  status?: Record<string, number>;
  steps: EvalStep[];
  /** Extra patterns the output must not contain (on top of the common ones in run.ts). */
  forbid?: { pattern: RegExp; why: string }[];
}

const index = "src/routes/index.tsx";

export const TASKS: EvalTask[] = [
  {
    id: "counter-step",
    title: "Counter with a step",
    template: "static",
    prompt: `Replace the home page with a counter. A number input \`#step\` (default 1) sets how much the buttons \`#inc\` ("Add") and \`#dec\` ("Subtract") change the count. Show the count in \`<output id="count">\`. The count starts at 0.`,
    files: [index],
    steps: [
      { expect: ["#count", "0"] },
      { click: "#inc" },
      { expect: ["#count", "1"] },
      { fill: ["#step", "5"] },
      { click: "#inc" },
      { expect: ["#count", "6"] },
      { click: "#dec" },
      { expect: ["#count", "1"] },
    ],
  },
  {
    id: "todo-list",
    title: "Todo list",
    template: "static",
    prompt: `Build a todo list on the home page. A text input \`#new\` and a button \`#add\` add a todo (ignore empty text, clear the input after adding). Show todos in \`<ul id="todos">\`; each \`<li>\` has a checkbox (\`input.done\`) that marks it done and a button \`button.remove\` (accessible name "Remove <text>") that deletes it. \`#remaining\` shows "<n> left" (todos not done). Start with one todo: "Read the docs".`,
    files: [index],
    steps: [
      { count: ["#todos li", 1] },
      { expect: ["#remaining", "1 left"] },
      { fill: ["#new", "Write tests"] },
      { click: "#add" },
      { count: ["#todos li", 2] },
      { expect: ["#todos", "Write tests"] },
      { expect: ["#remaining", "2 left"] },
      // The input was cleared: a second press adds nothing.
      { click: "#add" },
      { count: ["#todos li", 2] },
      { click: "#todos li:nth-child(1) input.done" },
      { expect: ["#remaining", "1 left"] },
      { click: "#todos li:nth-child(1) button.remove" },
      { count: ["#todos li", 1] },
      { expect: ["#todos", "Write tests"] },
    ],
  },
  {
    id: "disclosure",
    title: "Disclosure component",
    template: "static",
    prompt: `Create a reusable \`Disclosure\` component in \`src/components/Disclosure.tsx\` (props: \`title\` and children). It renders a button that toggles its content; the button has \`aria-expanded\` and \`aria-controls\` pointing at the content. Content is hidden when closed. Use it on the home page twice: the first with id prefix "shipping" (button \`#shipping-button\`, title "Shipping", content "Ships in 2 days"), the second "returns" (\`#returns-button\`, "Returns", content "30 days to return"). Both start closed. Give the component an \`id\` prop for the prefix; the content element's id is \`<id>-panel\`.`,
    files: [index, "src/components/Disclosure.tsx"],
    steps: [
      { attr: ["#shipping-button", "aria-expanded", "false"] },
      { absent: "#shipping-panel:not([hidden])" },
      { click: "#shipping-button" },
      { attr: ["#shipping-button", "aria-expanded", "true"] },
      { expect: ["#shipping-panel", "Ships in 2 days"] },
      { attr: ["#returns-button", "aria-expanded", "false"] },
      { click: "#shipping-button" },
      { attr: ["#shipping-button", "aria-expanded", "false"] },
    ],
  },
  {
    id: "cart-total",
    title: "Cart with a formatted total",
    template: "static",
    prompt: `Show a cart on the home page with three products: Pen (€1.50), Notebook (€4.00), Bag (€25.00). Each row has a quantity number input with id \`qty-<name in lower case>\` (start at 1, minimum 0). \`#total\` shows the total formatted as euros with \`Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" })\` (e.g. "€30.50"). Update the total as quantities change.`,
    files: [index],
    steps: [
      { expect: ["#total", "€30.50"] },
      { fill: ["#qty-pen", "3"] },
      { expect: ["#total", "€33.50"] },
      { fill: ["#qty-bag", "0"] },
      { expect: ["#total", "€8.50"] },
    ],
  },
  {
    id: "tabs",
    title: "Keyboard tabs",
    template: "static",
    prompt: `Build accessible tabs on the home page: a \`role="tablist"\` with three \`role="tab"\` buttons (\`#tab-1\` "Overview", \`#tab-2\` "Specs", \`#tab-3\` "Reviews") and one visible \`role="tabpanel"\` with id \`#panel\` showing "<tab name> content". The selected tab has \`aria-selected="true"\` and \`tabindex="0"\`, others \`"false"\` / \`"-1"\`. Click selects; ArrowRight / ArrowLeft move selection and focus (wrapping around).`,
    files: [index],
    steps: [
      { attr: ["#tab-1", "aria-selected", "true"] },
      { expect: ["#panel", "Overview content"] },
      { click: "#tab-3" },
      { attr: ["#tab-3", "aria-selected", "true"] },
      { expect: ["#panel", "Reviews content"] },
      { press: ["#tab-3", "ArrowRight"] },
      { focused: "#tab-1" },
      { attr: ["#tab-1", "aria-selected", "true"] },
      { attr: ["#tab-3", "tabindex", "-1"] },
      { press: ["#tab-1", "ArrowLeft"] },
      { expect: ["#panel", "Reviews content"] },
    ],
  },
  {
    id: "filter-list",
    title: "Filtered list",
    template: "static",
    prompt: `On the home page, show a search input \`#q\` (label "Search fruit") and a list \`<ul id="results">\` of these fruits: Apple, Banana, Cherry, Mango, Orange. Typing filters the list (case-insensitive substring). Each \`<li>\` has \`data-name="<fruit>"\`. When nothing matches, show \`<p id="empty">No fruit matches</p>\` instead of the list items.`,
    files: [index],
    steps: [
      { count: ["#results li", 5] },
      { fill: ["#q", "an"] },
      { count: ["#results li", 3] },
      { absent: 'li[data-name="Cherry"]' },
      { matches: 'li[data-name="Mango"]' },
      { fill: ["#q", "zz"] },
      { expect: ["#empty", "No fruit matches"] },
      { fill: ["#q", ""] },
      { count: ["#results li", 5] },
    ],
  },
  {
    id: "new-route",
    title: "New page with a link",
    template: "static",
    prompt: `Add a page at \`/team\` with an \`<h1>\` "Team" and a list of three names (Ada, Grace, Linus) in \`<ul id="people">\`, and a link back home (\`#home-link\`). On the home page, add a link \`#team-link\` with the text "Meet the team" to the new page (use the URL with a trailing slash, \`/team/\`). Keep the existing home content.`,
    files: [index, "src/routes/team.tsx"],
    steps: [{ click: "#team-link" }, { expect: ["h1", "Team"] }, { count: ["#people li", 3] }, { click: "#home-link" }, { matches: "#team-link" }],
  },
  {
    id: "dynamic-route",
    title: "Route with a parameter",
    template: "server",
    prompt: `Add a product page at \`/products/<id>\`. Products live in a server-only list: \`{ id: "1", name: "Chair", price: 49 }\`, \`{ id: "2", name: "Lamp", price: 19 }\`. Load the product on the server; an unknown id answers 404. The page shows \`<h1>\` with the name and \`#price\` "$<price>". Keep the existing home page.`,
    files: ["src/routes/products/[id].tsx"],
    open: "/products/2",
    status: { "/products/1": 200, "/products/9": 404 },
    steps: [{ expect: ["h1", "Lamp"] }, { expect: ["#price", "$19"] }],
  },
  {
    id: "server-action",
    title: "Guestbook with a server action",
    template: "server",
    prompt: `Replace the home page with a guestbook. Entries are kept in server memory, starting with "Hello from the server". Show them in \`<ul id="entries">\`. A form (POST to an action named \`sign\`) has a text input \`#message\` (name \`message\`, required) and a submit button \`#sign\`. Signing adds the trimmed message (max 140 characters) and returns to the page without a resubmit on reload. It must work without JavaScript.`,
    files: [index],
    steps: [
      { count: ["#entries li", 1] },
      { fill: ["#message", "First visit"] },
      { click: "#sign" },
      { expect: ["#entries", "First visit"] },
      { reload: true },
      { count: ["#entries li", 2] },
    ],
  },
  {
    id: "loader-search",
    title: "Search from the URL",
    template: "server",
    prompt: `Replace the home page with a book search. A GET form with input \`#q\` (name \`q\`) and button \`#search\` filters this list on the server: "Dune", "Emma", "Ulysses", "Dracula", "Beloved" (case-insensitive substring of \`q\`). Results go in \`<ol id="books">\`; \`#summary\` says "<n> books" (or "<n> books for “<q>”" when q is set — plain quotes are fine too). The input keeps the current query.`,
    files: [index],
    steps: [
      { count: ["#books li", 5] },
      { fill: ["#q", "du"] },
      { click: "#search" },
      { count: ["#books li", 1] },
      { expect: ["#books", "Dune"] },
      { attr: ["#q", "value", "du"] },
      { expect: ["#summary", "1 books"] },
    ],
  },
  {
    id: "validated-form",
    title: "Validated signup form",
    template: "server",
    prompt: `Replace the home page with a newsletter signup form built with \`@rivetjs/forms\` and a \`zod\` schema in \`src/forms/signup.ts\`: \`email\` (valid email, message "Enter a valid email") and \`name\` (at least 2 characters, message "Enter your name"). The server action \`signup\` stores the email in server memory; an email already signed up is rejected with "Already subscribed". Inputs have ids \`#signup-name\` / \`#signup-email\` (use the form helpers so ids and error elements line up: errors render in \`#signup-name-error\` / \`#signup-email-error\`), submit button \`#subscribe\`. After a successful signup show \`<p id="thanks">Thanks for subscribing</p>\`. "taken@example.com" is already subscribed.`,
    files: [index, "src/forms/signup.ts"],
    steps: [
      { fill: ["#signup-name", "A"] },
      { fill: ["#signup-email", "nope"] },
      { click: "#subscribe" },
      { expect: ["#signup-email-error", "Enter a valid email"] },
      { expect: ["#signup-name-error", "Enter your name"] },
      { fill: ["#signup-name", "Ada"] },
      { fill: ["#signup-email", "taken@example.com"] },
      { click: "#subscribe" },
      { expect: ["#signup-email-error", "Already subscribed"] },
      { fill: ["#signup-email", "ada@example.com"] },
      { click: "#subscribe" },
      { expect: ["#thanks", "Thanks for subscribing"] },
    ],
  },
  {
    id: "drawer-form",
    title: "Form in a drawer on a live page",
    template: "server",
    prompt: `Replace the home page with a contact list kept in server memory (start: "Ada Lovelace" / "ada@example.com"). Show contacts in \`<ul id="contacts">\` and a counter button \`#likes\` ("Liked <n>"). A button or link \`#add\` opens a drawer (a modal dialog, \`role="dialog"\`) with a validated form (\`@rivetjs/forms\` + zod, \`src/forms/contact.ts\`: \`name\` min 1 "Enter a name", \`email\` valid "Enter an email"): inputs \`#contact-name\`, \`#contact-email\`, errors in \`#contact-email-error\`, submit \`#save\`. A duplicate email is rejected by the server with "Already a contact" and the drawer stays open. On success the drawer closes and the list updates in place, without reloading the page: the like count survives.`,
    files: [index, "src/forms/contact.ts"],
    steps: [
      { click: "#likes" },
      { expect: ["#likes", "Liked 1"] },
      { click: "#add" },
      { matches: '[role="dialog"]' },
      { fill: ["#contact-name", "Ada Again"] },
      { fill: ["#contact-email", "ada@example.com"] },
      { click: "#save" },
      { expect: ["#contact-email-error", "Already a contact"] },
      { fill: ["#contact-email", "ada2@example.com"] },
      { click: "#save" },
      { expect: ["#contacts", "Ada Again"] },
      { absent: '[role="dialog"]' },
      { expect: ["#likes", "Liked 1"] },
    ],
  },
  {
    id: "ui-like-chip",
    title: "@rivetjs/ui button and chip",
    template: "ui",
    prompt: `Replace the home page with a @rivetjs/ui \`Card\` titled "Votes". In it, a @rivetjs/ui \`Button\` \`#vote\` ("Vote") and a @rivetjs/ui \`Chip\` \`#votes\` showing "<n> votes". Pressing the button adds one. The chip is color "success" once there are 3 or more votes, "default" before.`,
    files: [index],
    steps: [{ expect: ["#votes", "0 votes"] }, { click: "#vote" }, { click: "#vote" }, { click: "#vote" }, { expect: ["#votes", "3 votes"] }],
  },
  {
    id: "ui-modal",
    title: "@rivetjs/ui modal",
    template: "ui",
    prompt: `On the home page add a @rivetjs/ui \`Button\` \`#open\` ("Delete account") that opens a @rivetjs/ui \`Modal\` with the heading "Delete account?", the text "This cannot be undone." and two buttons: \`#cancel\` ("Cancel", closes it) and \`#confirm\` ("Delete", closes it and shows \`<p id="status">Account deleted</p>\` on the page). Escape also closes it.`,
    files: [index],
    steps: [
      { click: "#open" },
      { matches: '[role="dialog"]' },
      { name: ['[role="dialog"]', "Delete account?"] },
      { click: "#cancel" },
      { absent: '[role="dialog"]' },
      { absent: "#status" },
      { click: "#open" },
      { key: "Escape" },
      { absent: '[role="dialog"]' },
      { click: "#open" },
      { click: "#confirm" },
      { expect: ["#status", "Account deleted"] },
    ],
  },
  {
    id: "ui-select",
    title: "@rivetjs/ui select",
    template: "ui",
    prompt: `On the home page add a @rivetjs/ui \`Select\` labelled "Plan" with three options (ids \`free\`, \`pro\`, \`team\`; texts "Free", "Pro", "Team"), nothing selected at first (placeholder "Choose a plan"). Below it, \`<p id="chosen">\` shows "Plan: <id>" for the selection, or "Plan: none".`,
    files: [index],
    steps: [
      { expect: ["#chosen", "Plan: none"] },
      { click: "button:has-text('Choose a plan')" },
      { click: "[role=option]:has-text('Pro')" },
      { expect: ["#chosen", "Plan: pro"] },
    ],
  },
  {
    id: "icon-buttons",
    title: "Icon buttons",
    template: "ui",
    prompt: `On the home page show a list \`<ul id="files">\` with three files ("notes.txt", "photo.png", "song.mp3"). Each \`<li>\` has \`data-file="<file name>"\`, a file icon (lucide \`File\`) and an icon-only delete button (lucide \`Trash2\`, accessible name "Delete <file name>") that removes the row. Use the icon component the project instructions name; no other icon source.`,
    files: [index],
    forbid: [{ pattern: /<svg\b/, why: "inline <svg> (use the Icon component)" }],
    steps: [
      { count: ["#files li", 3] },
      { count: ["#files li svg", 6] },
      { name: ["#files li:nth-child(2) button", "Delete photo.png"] },
      { click: "#files li:nth-child(2) button" },
      { count: ["#files li", 2] },
      { absent: '#files li[data-file="photo.png"]' },
    ],
  },
  {
    id: "ticking-clock",
    title: "Seconds since load",
    template: "static",
    prompt: `On the home page show \`<span id="ticks">\` counting the seconds since the page became interactive in the browser (0, 1, 2, …, one per second), and a button \`#pause\` that toggles "Pause" / "Resume" and stops / restarts the counting. Clean up the timer properly.`,
    files: [index],
    steps: [{ expect: ["#ticks", "2"] }, { click: "#pause" }, { expect: ["#pause", "Resume"] }, { click: "#pause" }, { expect: ["#pause", "Pause"] }],
  },
  {
    id: "persisted-theme",
    title: "Theme saved in localStorage",
    template: "static",
    prompt: `Add a theme switch to the home page: button \`#theme\` toggles between "light" and "dark"; the current theme is set as \`data-theme\` on the \`<html>\` element and shown as the button text ("Theme: light"). Save the choice in \`localStorage\` (key "theme") and restore it when the page loads again. Default "light".`,
    files: [index],
    steps: [
      { expect: ["#theme", "Theme: light"] },
      { click: "#theme" },
      { attr: ["html", "data-theme", "dark"] },
      { expect: ["#theme", "Theme: dark"] },
      { reload: true },
      { attr: ["html", "data-theme", "dark"] },
      { expect: ["#theme", "Theme: dark"] },
    ],
  },
  {
    id: "window-size",
    title: "Window width",
    template: "static",
    prompt: `On the home page show the browser window's inner width in \`<span id="width">\` (only a number) and keep it updated when the window is resized. \`#size\` says "narrow" below 768 px, else "wide". Before JavaScript runs (in the server HTML) both may be empty.`,
    files: [index],
    steps: [
      { expect: ["#width", "1280"] },
      { expect: ["#size", "wide"] },
      { viewport: [600, 700] },
      { expect: ["#width", "600"] },
      { expect: ["#size", "narrow"] },
    ],
  },
  {
    id: "port-react-rating",
    title: "Port a React component",
    template: "static",
    prompt: `Port this React component to Rivet as \`src/components/Rating.tsx\` (same props and behaviour; the parent owns the value), then use it on the home page with a value that starts at 3, and show \`<p id="value">Rating: <n></p>\` next to it.

\`\`\`tsx
import { useState } from "react";

export function Rating({ value, onChange, max = 5 }: { value: number; onChange: (v: number) => void; max?: number }) {
  const [hover, setHover] = useState(0);
  return (
    <div role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          aria-label={\`\${n} star\${n > 1 ? "s" : ""}\`}
          className={n <= (hover || value) ? "star on" : "star"}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
\`\`\``,
    files: [index, "src/components/Rating.tsx"],
    forbid: [{ pattern: /\buse(State|Effect|Memo|Callback)\b/, why: "React hooks" }],
    steps: [
      { expect: ["#value", "Rating: 3"] },
      { attr: ['[aria-label="3 stars"]', "aria-checked", "true"] },
      { click: '[aria-label="4 stars"]' },
      { expect: ["#value", "Rating: 4"] },
      { attr: ['[aria-label="4 stars"]', "aria-checked", "true"] },
      { attr: ['[aria-label="3 stars"]', "aria-checked", "false"] },
      { hover: '[aria-label="5 stars"]' },
      { attr: ['[aria-label="5 stars"]', "class", "star on"] },
    ],
  },
  {
    id: "live-props",
    title: "Child component with changing props",
    template: "static",
    prompt: `Create \`src/components/Badge.tsx\`: a \`Badge\` component with props \`count: number\` and \`label: string\` that renders \`<span class="badge">\` with "<count> <label>" and the attribute \`data-empty\` present only when count is 0. On the home page keep a cart count (start 0) with buttons \`#add\` (+1) and \`#clear\` (to 0), and render \`<Badge count={…} label="items" />\` inside \`<div id="cart">\`.`,
    files: [index, "src/components/Badge.tsx"],
    steps: [
      { expect: ["#cart .badge", "0 items"] },
      { matches: "#cart .badge[data-empty]" },
      { click: "#add" },
      { click: "#add" },
      { expect: ["#cart .badge", "2 items"] },
      { absent: "#cart .badge[data-empty]" },
      { click: "#clear" },
      { expect: ["#cart .badge", "0 items"] },
      { matches: "#cart .badge[data-empty]" },
    ],
  },
];
