import type { I18nRouteConfig } from "@rivetjs/i18n/router";

export const config = {
  locales: ["en", "de"],
  defaultLocale: "en",
  catalogs: "locales/{locale}.json",
  routing: { prefix: "as-needed" },
  baseUrl: "https://shop.test",
} satisfies I18nRouteConfig & { catalogs: string };
