import { defineForm } from "@rivetjs/forms";
import { z } from "zod";

export const signupForm = defineForm({
  name: "signup",
  schema: z.object({
    name: z.string().min(2, "Enter your name"),
    email: z.string().email("Enter a valid email"),
  }),
});
