export interface UiSetupGeneratorSchema {
  /** The Rivet app. */
  project: string;
  rivetVersion?: string;
  skipPackageJson?: boolean;
  skipFormat?: boolean;
}
