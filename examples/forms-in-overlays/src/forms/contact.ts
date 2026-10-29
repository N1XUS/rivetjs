import { defineForm } from "@rivetjs/forms";
import { z } from "zod";

const fields = {
  name: z.string().trim().min(1, "Enter a name"),
  email: z.string().trim().email("Enter an email address like name@example.com"),
  company: z.string().trim().max(60, "Keep it under 60 characters"),
};

// `emptyAs: "string"` posts an empty field as "" (Company may stay empty; Name gets its own message).
// One definition per action: the name is the action (`<form action="?/create">`) and the form id.
export const createContactForm = defineForm({ name: "create", schema: z.object(fields), emptyAs: "string" });
export const updateContactForm = defineForm({ name: "update", schema: z.object({ id: z.coerce.number().int().positive(), ...fields }), emptyAs: "string" });
export const deleteContactForm = defineForm({ name: "remove", schema: z.object({ id: z.coerce.number().int().positive() }) });
