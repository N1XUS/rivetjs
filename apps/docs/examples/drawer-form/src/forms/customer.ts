import { defineForm } from "@rivetjs/forms";
import { z } from "zod";

export const customerForm = defineForm({
  name: "customer", // the action name: <form action="?/customer">
  schema: z.object({
    name: z.string().min(1, "Enter a name"),
    email: z.string().email("Enter an email address like name@example.com"),
  }),
});
