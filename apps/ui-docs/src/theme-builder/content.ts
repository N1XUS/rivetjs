// Theme builder preview content (invented data). A plain `.ts` leaf: resumed handlers and bindings of the preview
// tiles import these directly, so reading `INVOICES` does not evaluate the tile modules and every ui component they
// import (resume chunks import a component module's scope by evaluating that module).

import { Building2, Globe, Rocket, ShieldCheck, Users } from "lucide";

export const COLORS = ["default", "accent", "success", "warning", "danger"] as const;
export const PEOPLE = [
  { initials: "AL", name: "Ada Lovelace", role: "Owner", color: "accent" },
  { initials: "GH", name: "Grace Hopper", role: "Editor", color: "success" },
  { initials: "AT", name: "Alan Turing", role: "Viewer", color: "warning" },
] as const;
export const TOKENS = ["background", "surface", "surface-secondary", "default", "accent", "success", "warning", "danger", "muted", "foreground"];
export const VIEWS = ["Day", "Week", "Month"] as const;

export const INVOICES = [
  { id: "INV-2041", customer: "Northwind", amount: "$1,240", status: "Paid" },
  { id: "INV-2042", customer: "Globex", amount: "$860", status: "Pending" },
  { id: "INV-2043", customer: "Initech", amount: "$2,115", status: "Overdue" },
  { id: "INV-2044", customer: "Umbrella", amount: "$430", status: "Paid" },
] as const;
export const STATUS_COLOR = { Paid: "success", Pending: "warning", Overdue: "danger" } as const;
export const TOPICS = [
  { id: "frontend", label: "Frontend" },
  { id: "design-system", label: "Design system" },
  { id: "a11y", label: "Accessibility" },
  { id: "perf", label: "Performance" },
];
export const FAQ = [
  { icon: Rocket, title: "How do deploys work?", body: "Every merge to main builds a preview, then promotes it once the checks pass." },
  { icon: ShieldCheck, title: "Who can change settings?", body: "Owners and admins. Editors can propose changes for review." },
  { icon: Globe, title: "Where is data stored?", body: "In the region you picked when creating the project." },
];
export const ANSWER = "Your theme passes AA on most pairs. Raise the accent lightness a little if white text sits on it.";

export const ROLES = [
  { id: "design", label: "Design" },
  { id: "engineering", label: "Engineering" },
  { id: "marketing", label: "Marketing" },
  { id: "product", label: "Product" },
  { id: "sales", label: "Sales" },
];
export const TIMEZONES = [
  { id: "lisbon", label: "Lisbon (UTC+1)" },
  { id: "berlin", label: "Berlin (UTC+2)" },
  { id: "kyiv", label: "Kyiv (UTC+3)" },
  { id: "new-york", label: "New York (UTC−4)" },
  { id: "tokyo", label: "Tokyo (UTC+9)" },
];
export const CHANNELS = [
  { id: "mentions", label: "Mentions", description: "Someone @mentions you or replies to a thread.", on: true },
  { id: "digest", label: "Weekly digest", description: "A summary of your projects every Monday.", on: true },
  { id: "product", label: "Product updates", description: "New features and changelog highlights.", on: false },
];
export const PLANS = [
  { id: "starter", label: "Starter", description: "For side projects", price: "$0", icon: Rocket },
  { id: "pro", label: "Pro", description: "For growing teams", price: "$24", icon: Users },
  { id: "enterprise", label: "Enterprise", description: "SSO, audit log, SLA", price: "Custom", icon: Building2 },
];
