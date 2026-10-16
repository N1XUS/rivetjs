import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// Document links (`tests/document-links.test.ts`): links to URLs no page route matches load documents.
export default defineConfig({ plugins: [rivetRouter()], logLevel: "warn" });
