// Stand-in for a real data source (a database, a message queue, another service).
let visitors = 120;

/** A number that changes a little each time you ask. */
export function currentVisitors(): number {
  visitors = Math.max(0, visitors + Math.round(Math.random() * 10 - 5));
  return visitors;
}
