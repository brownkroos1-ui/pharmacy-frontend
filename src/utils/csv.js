const escapeCell = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const buildCsv = (headers, rows) => {
  const headerLine = headers.map(escapeCell).join(",");
  const body = rows.map((row) => row.map(escapeCell).join(","));
  return [headerLine, ...body].join("\n");
};

export const downloadCsv = (filename, headers, rows) => {
  const csvContent = buildCsv(headers, rows);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
