import { defineForm } from "@rivetjs/forms";
import { z } from "zod";

// #region demo
// One definition, used by the page (browser checks) and the action (server checks).
export const contactForm = defineForm({
  name: "contact", // must match the action name: <form action="?/contact">
  schema: z.object({
    email: z.string().email("Enter an email address like name@example.com"),
    message: z.string().min(10, "Write at least 10 characters"),
  }),
  validateOn: "blur", // show a field's problem when the user leaves it
});
// #endregion
