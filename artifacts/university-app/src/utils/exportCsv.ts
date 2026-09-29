/**
 * downloadCsv — typed CSV export utility.
 *
 * Two call signatures:
 *  1. downloadCsv(data: object[], filename?: string)
 *     Derives headers from the first object's keys.
 *  2. downloadCsv(filename: string, headers: string[], rows: unknown[][])
 *     Explicit column names and pre-built row arrays.
 */

type CsvValue = string | number | boolean | null | undefined;

function downloadCsv(data: Record<string, CsvValue>[], filename?: string): void;
function downloadCsv(filename: string, headers: string[], rows: CsvValue[][]): void;
function downloadCsv(
  arg1: Record<string, CsvValue>[] | string,
  arg2?: string | string[],
  arg3?: CsvValue[][]
): void {
  let filename = 'export.csv';
  let headers: string[] = [];
  let rows: CsvValue[][] = [];

  if (Array.isArray(arg1)) {
    // Signature 1: downloadCsv(dataObjectsArray, filename?)
    filename = typeof arg2 === 'string' ? arg2 : 'export.csv';
    const dataObjects = arg1;
    if (dataObjects.length === 0) return;
    headers = Object.keys(dataObjects[0]);
    rows = dataObjects.map((obj) => headers.map((key) => obj[key]));
  } else {
    // Signature 2: downloadCsv(filename, headers, rows)
    filename = typeof arg1 === 'string' ? arg1 : 'export.csv';
    headers = Array.isArray(arg2) ? (arg2 as string[]) : [];
    rows = Array.isArray(arg3) ? arg3 : [];
  }

  const escape = (val: CsvValue): string => {
    const s = val == null ? '' : String(val);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) => (Array.isArray(row) ? row.map(escape).join(',') : '')),
  ];

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export { downloadCsv };
