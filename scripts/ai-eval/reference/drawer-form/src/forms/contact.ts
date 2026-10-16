import { defineForm } from "@rivetjs/forms";
import { z } from "zod";

export const contactForm = defineForm({
  name: "contact",
  schema: z.object({
    name: z.string().min(1, "Enter a name"),
    email: z.string().email("Enter an email"),
  }),
});
