// A tiny Standard Schema v1 builder for the demo (any Standard Schema library works the same:
// Zod, Valibot, ArkType). Rules return an issue key or nothing; keys double as messages here.
import type { StandardSchemaV1 } from "@rivetjs/forms";

type Rule = (value: unknown, all: Record<string, unknown>) => string | undefined;
export const required: Rule = (value) => (value === undefined || value === "" || value === false ? "This field is required" : undefined);
export const email: Rule = (value) => (typeof value === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "Enter an email address like name@example.com" : undefined);
export const minLength =
  (n: number): Rule =>
  (value) =>
    typeof value === "string" && value.length < n ? `Use at least ${n} characters` : undefined;
export const integerBetween =
  (min: number, max: number): Rule =>
  (value) =>
    value !== undefined && (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) ? `Enter a whole number from ${min} to ${max}` : undefined;
export const sameAs =
  (other: string, message: string): Rule =>
  (value, all) =>
    value !== all[other] ? message : undefined;

/** An object schema: every field's rules run in order; the first failing rule is the field's issue. */
export function object<T extends Record<string, unknown>>(rules: { [K in keyof T]-?: Rule[] }): StandardSchemaV1<T, T> {
  return {
    "~standard": {
      version: 1,
      vendor: "playground",
      validate(input) {
        const all = (input ?? {}) as Record<string, unknown>;
        const issues: StandardSchemaV1.Issue[] = [];
        for (const key in rules) {
          for (const rule of rules[key]) {
            const message = rule(all[key], all);
            if (message) {
              issues.push({ message, path: [key] });
              break;
            }
          }
        }
        return issues.length ? { issues } : { value: all as T };
      },
    },
  };
}
