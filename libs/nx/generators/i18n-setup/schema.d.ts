export interface I18nSetupGeneratorSchema {
  /** The Rivet app. */
  project: string;
  /** Comma-separated locales, the default first (`en,de`). */
  locales?: string;
  /** Default locale (default: the first of `locales`). */
  defaultLocale?: string;
  /** Locale prefix in URLs: `as-needed` (default), `always`, `never`. */
  prefix?: "as-needed" | "always" | "never";
  rivetVersion?: string;
  skipPackageJson?: boolean;
  skipFormat?: boolean;
}
