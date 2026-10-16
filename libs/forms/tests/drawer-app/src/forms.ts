// Form definitions (module scope, universal): the page's handlers and the action import them.
import { defineForm } from "@rivetjs/forms";
import { email, object, required } from "./schema.js";

export type NewCustomer = { name: string; email: string };
export const customerForm = defineForm({ name: "customer", schema: object<NewCustomer>({ name: [required], email: [required, email] }) });
