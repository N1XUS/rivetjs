// Marker: `import "@rivetjs/router/server-only"` in a module that must never reach a browser bundle.
// Browser builds of the router plugin fail on this import; on the server it is empty.
export {};
