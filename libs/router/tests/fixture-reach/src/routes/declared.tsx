import "@rivetjs/router/server-only";
import { Card } from "../components/Card.tsx";

// The page declares itself server-only: a document route, components reaching server-only modules included.
export default function Declared() {
  return <Card />;
}
