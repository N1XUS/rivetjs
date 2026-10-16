// Server-only module: the `.server.ts` name means browser code may never import it.
// Put database clients and secrets in files like this one.
const books = [
  { id: "1", title: "Kindred", year: 1979 },
  { id: "2", title: "Piranesi", year: 2020 },
];

export async function listBooks() {
  return books;
}
