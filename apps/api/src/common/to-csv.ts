function escapeCsvCell(value: unknown): string {
  // Objeto ou função cairiam no toString do Object e virariam "[object Object]"
  // na célula, sem erro nenhum — o relatório sairia com uma coluna inútil.
  let str: string;
  if (value === null || value === undefined) {
    str = '';
  } else if (typeof value === 'string') {
    str = value;
  } else if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    str = String(value);
  } else if (value instanceof Date) {
    str = value.toISOString();
  } else {
    str = JSON.stringify(value) ?? '';
  }
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
