// Loaded on the first press (a lazily loaded part): its own stylesheet, and the button's, which the page has already.
import "./panel.css";
import { label } from "./button.tsx";

export const panelText = (): string => label("panel");
