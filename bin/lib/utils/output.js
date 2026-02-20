// Output formatting utilities
export function formatSuccess(message, data) {
    const output = {
        success: true,
        message,
        ...(data && { data })
    };
    return JSON.stringify(output, null, 2);
}
export function formatError(code, message, details) {
    const output = {
        success: false,
        error: code,
        message,
        ...(details && { details })
    };
    return JSON.stringify(output, null, 2);
}
export function formatTable(headers, rows) {
    const colWidths = headers.map((h, i) => {
        const maxRowWidth = Math.max(...rows.map(r => (r[i] || '').length));
        return Math.max(h.length, maxRowWidth);
    });
    const separator = colWidths.map(w => '-'.repeat(w + 2)).join('+');
    const headerRow = '|' + headers.map((h, i) => ` ${h.padEnd(colWidths[i])} `).join('|') + '|';
    const dataRows = rows.map(row => '|' + row.map((cell, i) => ` ${(cell || '').padEnd(colWidths[i])} `).join('|') + '|');
    return [separator, headerRow, separator, ...dataRows, separator].join('\n');
}
export function formatKeyValue(pairs) {
    const maxKeyLength = Math.max(...Object.keys(pairs).map(k => k.length));
    return Object.entries(pairs)
        .map(([key, value]) => {
        const paddedKey = key.padEnd(maxKeyLength);
        return `${paddedKey} : ${value}`;
    })
        .join('\n');
}
//# sourceMappingURL=output.js.map