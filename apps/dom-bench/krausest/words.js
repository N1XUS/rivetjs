// Shared label vocabulary (25 adjectives x 11 colours x 13 nouns, the same list sizes and the same
// `Math.round(Math.random() * 1000) % length` selection as js-framework-benchmark implementations).
export const adjectives = ["pretty", "large", "big", "small", "tall", "short", "long", "handsome", "plain", "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful", "mushy", "odd", "unsightly", "adorable", "important", "inexpensive", "cheap", "expensive", "fancy"];
export const colours = ["red", "yellow", "blue", "green", "pink", "brown", "purple", "brown", "white", "black", "orange"];
export const nouns = ["table", "chair", "house", "bbq", "desk", "car", "pony", "cookie", "sandwich", "burger", "pizza", "mouse", "keyboard"];
const pick = (list) => list[Math.round(Math.random() * 1000) % list.length];
export const label = () => `${pick(adjectives)} ${pick(colours)} ${pick(nouns)}`;
