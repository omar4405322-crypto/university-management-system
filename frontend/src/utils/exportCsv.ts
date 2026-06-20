// FIXED [Phase 7.3]: CSV export helper for list pages
export function downloadCsv(filename: string, headers: string[], rows: Record<string, any>[]) {
  const escape = (val) => {
    const s = val == null ? '' : String(val);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [headers.map(escape).join(','), ...rows.map((row: any) => row.map(escape).join(','))];

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
