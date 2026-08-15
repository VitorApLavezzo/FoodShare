function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv<T extends Record<string, unknown>>(rows: T[], columns: (keyof T)[]): string {
  const header = columns.map((c) => escapeCsvCell(String(c))).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCsvCell(row[c])).join(','));
  return [header, ...lines].join('\n');
}
