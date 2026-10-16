// The order form's schema (zod), shared by the React form in both lanes.
import { z } from "zod";

export const orderSchema = z.object({
  customer: z.string().trim().min(2, "Enter the customer's name"),
  email: z.string().trim().email("Enter a valid email"),
  status: z.enum(["paid", "pending", "refunded", "failed"], { message: "Pick a status" }),
  // Typed as text in the form, a number after validation.
  total: z
    .string()
    .trim()
    .min(1, "Enter an amount")
    .pipe(z.coerce.number({ message: "Enter an amount" }).positive("The total must be above 0").max(100000, "At most 100,000")),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  gift: z.boolean(),
  notes: z.string().max(280, "At most 280 characters"),
});
export type OrderInput = z.input<typeof orderSchema>;
export type OrderValues = z.output<typeof orderSchema>;
