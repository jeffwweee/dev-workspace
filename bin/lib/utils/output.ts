// Output formatting utilities

export function formatSuccess(message: string, data?: Record<string, unknown>): string {
  const output: Record<string, unknown> = {
    success: true,
    message,
    ...(data && { data })
  };
  return JSON.stringify(output, null, 2);
}

export function formatError(code: string, message: string, details?: Record<string, unknown>): string {
  const output: Record<string, unknown> = {
    success: false,
    error: code,
    message,
    ...(details && { details })
  };
  return JSON.stringify(output, null, 2);
}

export function formatTable(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) => {
    const maxRowWidth = Math.max(...rows.map(r => (r[i] || '').length));
    return Math.max(h.length, maxRowWidth);
  });

  const separator = colWidths.map(w => '-'.repeat(w + 2)).join('+');

  const headerRow = '|' + headers.map((h, i) => ` ${h.padEnd(colWidths[i])} `).join('|') + '|';
  const dataRows = rows.map(row =>
    '|' + row.map((cell, i) => ` ${(cell || '').padEnd(colWidths[i])} `).join('|') + '|'
  );

  return [separator, headerRow, separator, ...dataRows, separator].join('\n');
}

export function formatKeyValue(pairs: Record<string, string | number | boolean>): string {
  const maxKeyLength = Math.max(...Object.keys(pairs).map(k => k.length));

  return Object.entries(pairs)
    .map(([key, value]) => {
      const paddedKey = key.padEnd(maxKeyLength);
      return `${paddedKey} : ${value}`;
    })
    .join('\n');
}
