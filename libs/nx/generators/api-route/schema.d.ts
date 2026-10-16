export interface ApiRouteGeneratorSchema {
  /** Endpoint path under `src/routes` (`api/health`, `api/items/[id]`). */
  path: string;
  /** The Rivet app. */
  project: string;
  /** Request handlers to write. Default `["get"]`. */
  methods?: ("get" | "post" | "put" | "patch" | "delete")[];
  skipFormat?: boolean;
}
