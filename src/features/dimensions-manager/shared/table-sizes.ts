export interface PredefinedTable {
  name: string;
  width: number;
  height: number;
  glassBottom: number | null;
  glassTop: number | null;
  comment: string | null;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

export function parseTableSizesCSV(csvContent: string): PredefinedTable[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const tables: PredefinedTable[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 5) continue;

    const name = fields[0];
    const width = parseFloat(fields[1]);
    const height = parseFloat(fields[2]);
    const glassBottom = fields[3] ? parseFloat(fields[3]) : null;
    const glassTop = fields[4] ? parseFloat(fields[4]) : null;
    const comment = fields[7] || null;

    if (!name || isNaN(width) || isNaN(height)) continue;

    tables.push({
      name,
      width,
      height,
      glassBottom: glassBottom !== null && !isNaN(glassBottom) ? glassBottom : null,
      glassTop: glassTop !== null && !isNaN(glassTop) ? glassTop : null,
      comment,
    });
  }

  return tables;
}
