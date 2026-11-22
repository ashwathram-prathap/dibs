// Serialize numeric coordinates directly. opentype.js 2's decimal rounding fails
// for floating point residues written as 1e-13, producing invalid "NaN" paths.
export function svgPath(
  commands: {
    type: string;
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }[],
) {
  return commands
    .map((c) => {
      const keys =
        c.type === 'C'
          ? ['x1', 'y1', 'x2', 'y2', 'x', 'y']
          : c.type === 'Q'
            ? ['x1', 'y1', 'x', 'y']
            : c.type === 'Z'
              ? []
              : ['x', 'y'];
      return (
        c.type +
        keys
          .map((k) => {
            const v = c[k as keyof typeof c];
            if (typeof v !== 'number' || !Number.isFinite(v))
              throw Error('Invalid glyph coordinate');
            return Number(v.toFixed(2));
          })
          .join(' ')
      );
    })
    .join('');
}
