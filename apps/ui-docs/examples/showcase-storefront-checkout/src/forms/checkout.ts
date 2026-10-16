import { defineForm } from "@rivetjs/forms";
import { z } from "zod";

export const checkoutForm = defineForm({
  name: "checkout", // the action name: <form action="?/checkout">
  schema: z.object({
    email: z.string().email("Enter an email address like name@example.com"),
    name: z.string().min(1, "Enter the name for the delivery"),
    address: z.string().min(5, "Enter a street address"),
    postcode: z.string().regex(/^[0-9]{5}$/, "Enter a 5-digit postcode"),
  }),
});
