export type DashKind = "em" | "en";

export type DashHit = {
  line: number;
  column: number;
  kind: DashKind;
};

const EM_DASH = "—";
const EN_DASH = "–";

/**
 * Finds every em dash and en dash in a piece of text.
 * Nothing a client or lead reads may contain one, so every generator's
 * validator calls this before an output is saved. Plain hyphens are allowed.
 */
export function findDashes(text: string): DashHit[] {
  const hits: DashHit[] = [];
  const lines = text.split("\n");

  lines.forEach((line, lineIndex) => {
    for (let columnIndex = 0; columnIndex < line.length; columnIndex += 1) {
      const character = line[columnIndex];
      if (character === EM_DASH || character === EN_DASH) {
        hits.push({
          line: lineIndex + 1,
          column: columnIndex + 1,
          kind: character === EM_DASH ? "em" : "en",
        });
      }
    }
  });

  return hits;
}
