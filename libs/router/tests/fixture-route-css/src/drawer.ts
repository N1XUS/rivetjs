// Loaded on the layout's first press (CSS-LAZY): a lazily loaded part of the layout with no stylesheet of its own, only
// component stylesheets the route sheets may hold (card: both routes, button: the index only).
import { label } from "./button.tsx";
import { Card } from "./card.tsx";

export const drawerText = (): string => label("drawer") + (typeof Card === "function" ? "" : "!");
