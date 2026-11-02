import { defineForm } from "@rivetjs/forms";
import { z } from "zod";

// Shared by the browser (validation as you type) and the server actions. Fields named `password` (any name matching
// /password|secret/i) are never echoed back after a failed POST.
const email = z.string().trim().toLowerCase().email("Enter an email address like name@example.com").max(254, "Use at most 254 characters");
// NIST SP 800-63B: length over composition rules; the upper bound caps the hashing work one request can ask for.
const newPassword = z.string().min(10, "Use at least 10 characters").max(128, "Use at most 128 characters");
const next = z.string().max(2000);

export const signInForm = defineForm({
  name: "signin",
  schema: z.object({ email, password: z.string().min(1, "Enter your password").max(128, "Use at most 128 characters"), next }),
  emptyAs: "string",
});
export const signUpForm = defineForm({
  name: "signup",
  schema: z.object({ name: z.string().trim().min(1, "Enter your name").max(80, "Use at most 80 characters"), email, password: newPassword, next }),
  emptyAs: "string",
});
export const changePasswordForm = defineForm({
  name: "password",
  schema: z.object({ current: z.string().min(1, "Enter your current password").max(128), password: newPassword }),
  emptyAs: "string",
  // `current` holds a password too, but its name does not say so.
  echo: { exclude: ["current"] },
});
export const resetRequestForm = defineForm({ name: "request", schema: z.object({ email }), emptyAs: "string" });
// `resetId` (the reset token) is echoed after a failed POST: the page rendered for a failed action has no query string
// to read it from. Not named `token`: forms never echo a secret name (`secretName`); this value is already in the
// page's own hidden input, so the echo exposes nothing new.
export const resetConfirmForm = defineForm({ name: "reset", schema: z.object({ resetId: z.string().max(100), password: newPassword }), emptyAs: "string" });
