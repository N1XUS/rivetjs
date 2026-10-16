// Motion suite, SSR lane react: the same 1000 elements through `motion/react` + React 19 `renderToString`.
import { renderToString } from "react-dom/server";
import { motion } from "motion/react";

const rows = Array.from({ length: 1000 }, (_, i) => i);
export const ssr = {
  plain: () =>
    renderToString(
      <ul>
        {rows.map((i) => (
          <li key={i} style={{ opacity: 1 }}>
            {"row " + i}
          </li>
        ))}
      </ul>,
    ),
  static: () =>
    renderToString(
      <ul>
        {rows.map((i) => (
          <motion.li key={i} animate={{ opacity: 1 }}>
            {"row " + i}
          </motion.li>
        ))}
      </ul>,
    ),
  entrance: () =>
    renderToString(
      <ul>
        {rows.map((i) => (
          <motion.li key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {"row " + i}
          </motion.li>
        ))}
      </ul>,
    ),
};
