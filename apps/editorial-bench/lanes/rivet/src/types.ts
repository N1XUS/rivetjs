export type Article = {
  slug: string;
  title: string;
  date: string;
  author: string;
  authorSlug: string;
  tags: string[];
  description: string;
  related: string[];
  body: string;
};
export type Teaser = { slug: string; title: string; date: string; day: string; author: string; description: string };
export type MdNode = {
  type: string;
  children?: MdNode[];
  value?: string;
  href?: string;
  depth?: number;
  lang?: string;
  ordered?: boolean;
};
