import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Select validation",
  summary: "isRequired with native validation, a validate function, a custom errorMessage and a server error from <Form validationErrors>.",
  tags: ["select", "forms", "validation"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#pet-hidden", "required", ""] },
    { matches: ".rv-Select[data-required] #pet-trigger" },
    // The server error shows from the start.
    { matches: ".rv-Select[data-invalid] #room-trigger" },
    { described: ["#room-trigger", "Room 2 is booked."] },
    // Submit with no pet: the error shows, the trigger takes focus, nothing is sent.
    { click: "#adopt-submit" },
    { expect: ["#pet-trigger-error", "Choose a pet."] },
    { described: ["#pet-trigger", "Choose a pet."] },
    { matches: ".rv-Select[data-invalid] #pet-trigger" },
    { focused: "#pet-trigger" },
    { expect: ["#adopt-out", ""] },
    // Choosing clears the error.
    { key: "ArrowDown" },
    { key: "Enter" },
    { expect: ["#pet-value", "Cat"] },
    { absent: ".rv-Select[data-invalid] #pet-trigger" },
    // validate runs on the value.
    { click: "#pal-trigger" },
    { click: "#pal-listbox-option-dog" },
    { expect: ["#pal-trigger-error", "Dogs are sold out."] },
    { click: "#pal-trigger" },
    { click: "#pal-listbox-option-fox" },
    { absent: ".rv-Select[data-invalid] #pal-trigger" },
    // Changing the field clears the server error.
    { click: "#room-trigger" },
    { click: "#room-listbox-option-1" },
    { absent: ".rv-Select[data-invalid] #room-trigger" },
    { click: "#adopt-submit" },
    { expect: ["#adopt-out", "Sent: cat"] },
  ],
});
