import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

// Drawer demo (file routes, resumed): a customer list with a "New customer" form in a cdk Modal drawer.
export default defineConfig({ plugins: [rivetRouter({ styles: ["src/styles.css"] })], logLevel: "warn" });
