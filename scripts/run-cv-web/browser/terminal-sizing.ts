// Choosing a font size is the only non-trivial logic in the page's setup, so it
// lives apart from the xterm wiring and is typed against the smallest interface
// that expresses it — no canvas, no DOM, testable with a fake terminal.

export interface ProposedDimensions {
  cols: number;
  rows: number;
}

export interface SizableTerminal {
  options: { fontSize?: number };
}

export interface DimensionProposer {
  proposeDimensions(): ProposedDimensions | undefined;
}

export interface FontBounds {
  maxFont: number;
  minFont: number;
  needColumns: number;
  needRows: number;
}

/**
 * Picks the largest font at which xterm itself reports enough columns and rows
 * for run-cv's whole screen. Uses xterm's real cell metrics rather than an
 * estimate of glyph size.
 *
 * `minFont` is a floor, not a candidate: if nothing down to it fits, the
 * terminal is simply too small and the smallest font is the best on offer.
 */
export function pickFontSize(
  term: SizableTerminal,
  fit: DimensionProposer,
  bounds: FontBounds,
): number {
  let size = bounds.maxFont;
  for (; size > bounds.minFont; size--) {
    term.options.fontSize = size;
    const proposed = fit.proposeDimensions();
    if (proposed && proposed.cols >= bounds.needColumns && proposed.rows >= bounds.needRows) break;
  }
  term.options.fontSize = size;
  return size;
}
