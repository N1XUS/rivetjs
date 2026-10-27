// Rivet addition (no HeroUI v3.2.6 counterpart): the interactive item card group on the cdk GridList (SHOWCASE-1
// 2026-10-27). Its own subpath, not an `@rivetjs/ui/item-card-group` export: a re-export there put the shared group
// variants into this chunk and every static group page loaded the GridList (measured +42.7 KB gz on item-card-group-list).
export { ItemCardGroupCollection } from "./item-card-group-collection.tsx";
export type { ItemCardGroupCollectionProps } from "./item-card-group-collection.tsx";
