// The data of the app. Later this could come from a file, an API or a database.
export interface Book {
  id: number;
  title: string;
  author: string;
  read: boolean;
}

export const initialBooks: Book[] = [
  { id: 1, title: "The Hobbit", author: "J. R. R. Tolkien", read: false },
  { id: 2, title: "Dune", author: "Frank Herbert", read: false },
  { id: 3, title: "Kindred", author: "Octavia E. Butler", read: true },
];
