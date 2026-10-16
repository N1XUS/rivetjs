import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DialogTrigger",
  summary:
    'A trigger button and a modal dialog with a form: the autofocus field takes focus, Save submits and closes through the close render prop, Button slot="close" cancels, focus returns.',
  tags: ["dialog", "modal", "form"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Closed: only the trigger; useOverlayTrigger({type: "dialog"}) sets no aria-haspopup.
    { attr: ["#profile-trigger", "aria-expanded", "false"] },
    { attr: ["#profile-trigger", "aria-haspopup", null] },
    { absent: "#profile" },
    { click: "#profile-trigger" },
    { matches: ".rv-ModalOverlay #profile[role=dialog]" },
    { name: ["#profile", "Edit profile"] },
    { attr: ["#profile-trigger", "aria-expanded", "true"] },
    { attr: ["#profile-trigger", "aria-controls", "profile"] },
    // useDialog: the [autofocus] field takes focus; the page behind is inert.
    { focused: "#profile-name" },
    { matches: "#profile-trigger[inert], [inert] #profile-trigger" },
    { fill: ["#profile-name", "Ada"] },
    // Tab order inside the dialog: field, Cancel, Save; Enter in the field submits.
    { key: "Tab" },
    { key: "Tab" },
    { focused: "#profile-save" },
    { press: ["#profile-name", "Enter"] },
    { absent: "#profile" },
    { expect: ["#profile-value", "Name: Ada"] },
    { focused: "#profile-trigger" },
    { absent: "#profile-trigger[inert], [inert] #profile-trigger" },
  ],
});
