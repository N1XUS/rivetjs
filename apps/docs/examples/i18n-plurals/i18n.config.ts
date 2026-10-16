import type { I18nRouteConfig } from "@rivetjs/i18n/router";

export const config = {
  locales: ["en", "uk"],
  defaultLocale: "en",
  catalogs: "locales/{locale}.json",
  // English at `/`, Ukrainian at `/uk`.
  routing: { prefix: "as-needed" },
} satisfies I18nRouteConfig & { catalogs: string };
