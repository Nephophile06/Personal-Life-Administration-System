/**
 * A very small CSV writer for Settings → Your data.
 * Values are escaped properly, numbers stay numeric, and strings that could be
 * read as spreadsheet formulas are prefixed with an apostrophe.
 */

const FORMULA = /^[=+\-@\t\r]/;

function cell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/**
 * @param {Array<{label: string, value?: (row: any) => any, key?: string}>} columns
 * @param {Array<object>} rows
 */
export function toCSV(columns, rows = []) {
  const head = columns.map((c) => cell(c.label)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => cell(typeof c.value === 'function' ? c.value(row) : row[c.key])).join(',')
  );
  // BOM keeps accented names readable when opened directly in Excel.
  return `\ufeff${[head, ...lines].join('\r\n')}\r\n`;
}

export function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}
