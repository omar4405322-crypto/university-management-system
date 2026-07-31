export function downloadCsv(arg1: any, arg2?: any, arg3?: any) {
  let filename = 'export.csv';
  let headers: string[] = [];
  let rows: any[][] = [];

  if (Array.isArray(arg1)) {
    // Pattern 1: downloadCsv(dataObjectsArray, filename)
    filename = typeof arg2 === 'string' ? arg2 : 'export.csv';
    const dataObjects = arg1;
    if (dataObjects.length === 0) return;
    headers = Object.keys(dataObjects[0]);
    rows = dataObjects.map((obj) => headers.map((key) => obj[key]));
  } else {
    // Pattern 2: downloadCsv(filename, headersArray, rowsArray)
    filename = typeof arg1 === 'string' ? arg1 : 'export.csv';
    headers = Array.isArray(arg2) ? arg2 : [];
    rows = Array.isArray(arg3) ? arg3 : [];
  }

  const escape = (val: any) => {
    const s = val == null ? '' : String(val);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row: any) => (Array.isArray(row) ? row.map(escape).join(',') : '')),
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
