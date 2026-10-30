/** The default slot maps to children; named slot attributes become Solid's camelCase content props. */
export const slotProp = (name: string): string => (name === "default" ? "children" : name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()));
