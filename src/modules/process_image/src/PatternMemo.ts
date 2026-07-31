/**
 * AYAB row-memo format (ayab-patterns#4, ayab-desktop#776/#779): the PNG
 * `Comment` tEXt value is `AYAB:` followed by one memo code per pattern
 * row, `0` meaning "no memo for this row". Example (ayab-patterns#4):
 * `AYAB:202020303030304040404040404040404040404040`.
 *
 * The spec proposes single digits 0-9, but real authored patterns in
 * ayab-patterns/StitchWorld (~7% of the 480 patterns that actually carry
 * AYAB: comments) use letter codes too, e.g.
 * `AYAB:FFF2FFF2FFF2FFF2NNNNNNN2NNNNN2NNN2NNNNNNN2NNNNN2NNN2`
 * (StitchWorld/215.png). Any character after the header is a valid memo
 * code; only "0" is special-cased as "no memo".
 */

const MEMO_HEADER = "AYAB:";
const NO_MEMO = "0";

/**
 * Per-row memo codes ("0" = none), one entry per character after the
 * `AYAB:` header. Returns `[]` if the comment is missing or lacks the
 * header.
 */
export function parseAyabMemos(comment: string | undefined): string[] {
  if (comment == null || !comment.startsWith(MEMO_HEADER)) {
    return [];
  }
  return comment.slice(MEMO_HEADER.length).split("");
}

/** True if `memos` carries any row-level memo (i.e. is worth showing in UI). */
export function hasAnyMemo(memos: ReadonlyArray<string>): boolean {
  return memos.some((memo) => memo !== NO_MEMO);
}
