export const tempoCorrido = (t: Date) => `${((Date.now() - t.valueOf()) / 1000).toFixed(2)}s`;
