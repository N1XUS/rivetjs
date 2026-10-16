// Form definitions (module scope, universal): handlers and actions import them; never serialized.
import { defineForm, type StandardSchemaV1 } from "@rivetjs/forms";
import { defineWizard } from "@rivetjs/forms/wizard";
import { email, integerBetween, minLength, object, required, sameAs } from "./schema.js";

export type Signup = {
  name: string;
  email: string;
  password: string;
  confirm: string;
  age?: number;
};
export const signupForm = defineForm({
  name: "signup",
  schema: object<Signup>({
    name: [required],
    email: [required, email],
    password: [required, minLength(8)],
    confirm: [required, sameAs("password", "Passwords do not match")],
    age: [integerBetween(13, 130)],
  }),
  coerce: { age: "number" },
  validateOn: "blur",
  // Async check (debounced, aborted by newer input); also enforced in the action.
  fields: {
    email: {
      server: true,
      validate: async (value) => {
        await new Promise((done) => setTimeout(done, 150));
        return typeof value === "string" && value.toLowerCase() === "taken@example.com" ? "That email is already registered" : undefined;
      },
    },
  },
});

export const accountStep = defineForm({
  name: "account",
  schema: object<{ name: string; email: string }>({ name: [required], email: [required, email] }),
  validateOn: "blur",
});
export const addressStep = defineForm({
  name: "address",
  schema: object<{ city: string; zip: string }>({ city: [required], zip: [required, minLength(4)] }),
  validateOn: "blur",
});
export const confirmStep = defineForm({ name: "confirm", schema: object<{ agree: boolean }>({ agree: [required] }), coerce: { agree: "boolean" } });
export const onboarding = defineWizard({ id: "onboarding", steps: [accountStep, addressStep, confirmStep] });

// Field array: order lines (`items.0.sku`, `items.0.qty`).
export type Order = { items: { sku: string; qty: number }[] };
const orderSchema: StandardSchemaV1<Order, Order> = {
  "~standard": {
    version: 1,
    vendor: "playground",
    validate(input) {
      const items = ((input as Partial<Order> | undefined)?.items ?? []) as Partial<Order["items"][number]>[];
      const issues: StandardSchemaV1.Issue[] = [];
      if (!items.length) issues.push({ message: "Add at least one line", path: ["items"] });
      items.forEach((item, index) => {
        if (!item?.sku) issues.push({ message: "Enter a product code", path: ["items", index, "sku"] });
        if (typeof item?.qty !== "number" || !Number.isInteger(item.qty) || item.qty < 1)
          issues.push({ message: "Enter a quantity of at least 1", path: ["items", index, "qty"] });
      });
      return issues.length ? { issues } : { value: input as Order };
    },
  },
};
// Same-URL action (notes page): one required field.
export const noteForm = defineForm({ name: "note", schema: object<{ note: string }>({ note: [required] }) });

export const orderForm = defineForm({ name: "order", schema: orderSchema, coerce: { "items.$.qty": "number" }, validateOn: "blur" });

// Custom submit: a third-party endpoint (formcarry-like) instead of a router action. Without JS the
// form posts natively to the same URL (its `action`).
export const CONTACT_ENDPOINT = "https://forms.example.test/contact";
export const contactForm = defineForm({
  name: "contact",
  schema: object<{ email: string; message: string }>({ email: [required, email], message: [required] }),
  validateOn: "blur",
  submit: async (value, { formData, signal }) => {
    const response = await fetch(CONTACT_ENDPOINT, { method: "POST", body: formData, headers: { accept: "application/json" }, signal });
    const body = (await response.json()) as { errors?: Record<string, string>; message?: string };
    if (response.status === 422) return { ok: false, issues: body.errors, form: body.message };
    if (!response.ok) throw new Error(body.message ?? "Could not send the message");
    return { ok: true, data: { to: value.email } };
  },
});
