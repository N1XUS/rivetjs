export interface PrerenderExecutorSchema {
  /** Build output folder, relative to the project (holds `client/` + `server/`). Default `dist`. */
  outputPath?: string;
  /** Run the project's own script instead (relative to the project, e.g. `prerender.js`). */
  script?: string;
}
