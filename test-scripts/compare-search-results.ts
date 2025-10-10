import fs from 'node:fs';
import path from 'node:path';

const type = process.env.COMPARE_TYPE ?? 'keyword';
const platform = process.env.COMPARE_PLATFORM ?? 'tiktok';

const baseDir = process.cwd();
const newDir = path.join(baseDir, 'logs', 'search-matrix', type, platform);
const legacyDir = path.join(baseDir, 'logs', 'search-matrix-legacy', type, platform);

function latestFile(dir: string): string {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.csv'));
  if (files.length === 0) {
    throw new Error(`No CSV files found in ${dir}`);
  }
  const latest = files
    .map((file) => ({ file, mtime: fs.statSync(path.join(dir, file)).mtime.getTime() }))
    .sort((a, b) => b.mtime - a.mtime)[0];
  return path.join(dir, latest.file);
}

function splitMetadata(raw: string) {
  const lines = raw.split(/\r?\n/);
  const metadata: Record<string, string> = {};
  let index = 0;
  while (index < lines.length && lines[index].startsWith('#')) {
    const line = lines[index];
    const [, key, value] = line.match(/^#\s*([^,]+),(.*)$/) || [];
    if (key) metadata[key.trim()] = value?.replace(/^"|"$/g, '') ?? '';
    index++;
  }
  // Skip blank lines
  while (index < lines.length && lines[index].trim() === '') index++;
  const remaining = lines.slice(index).join('\n');
  return { metadata, data: remaining };
}

function parseCsvData(raw: string) {
  const rows: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i <= raw.length; i++) {
    const char = raw[i] ?? '\n';
    if (char === '"') {
      if (inQuotes && raw[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      record.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && raw[i + 1] === '\n') i++;
      record.push(field);
      rows.push(record);
      field = '';
      record = [];
    } else {
      field += char;
    }
  }

  if (rows.length === 0) {
    throw new Error('CSV has no rows');
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);
  const formatted = dataRows.map((values) => {
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      const value = values[i] ?? '';
      row[header] = value;
    });
    return row;
  });

  return { headers, rows: formatted };
}

function parseCsv(filePath: string) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { metadata, data } = splitMetadata(raw);
  const { headers, rows } = parseCsvData(data);
  return { metadata, headers, rows };
}

function keyForRow(row: Record<string, string>): string {
  return (row.username || row.profile_url || row.name || '').toLowerCase();
}

function compare(newRows: Record<string, string>[], legacyRows: Record<string, string>[], headers: string[]) {
  const newMap = new Map<string, Record<string, string>>();
  const legacyMap = new Map<string, Record<string, string>>();

  for (const row of newRows) {
    const key = keyForRow(row);
    if (key) newMap.set(key, row);
  }

  for (const row of legacyRows) {
    const key = keyForRow(row);
    if (key) legacyMap.set(key, row);
  }

  const allKeys = new Set<string>([...newMap.keys(), ...legacyMap.keys()]);
  const differences: Array<{ username: string; field: string; legacy: string; current: string }> = [];

  for (const key of allKeys) {
    const legacyRow = legacyMap.get(key);
    const newRow = newMap.get(key);
    if (!legacyRow) {
      differences.push({ username: key, field: '__presence', legacy: 'absent', current: 'present' });
      continue;
    }
    if (!newRow) {
      differences.push({ username: key, field: '__presence', legacy: 'present', current: 'absent' });
      continue;
    }
    for (const field of headers) {
      const legacyValue = (legacyRow[field] ?? '').trim();
      const newValue = (newRow[field] ?? '').trim();
      if (legacyValue !== newValue) {
        differences.push({ username: key, field, legacy: legacyValue, current: newValue });
      }
    }
  }

  return differences;
}

function toCsv(rows: Record<string, string>[], columns: string[]): string {
  const header = columns.join(',');
  const body = rows
    .map((row) =>
      columns
        .map((column) => {
          const value = row[column] ?? '';
          const escaped = value.replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(',')
    )
    .join('\n');
  return `${header}\n${body}`;
}

function main() {
  const newFile = latestFile(newDir);
  const legacyFile = latestFile(legacyDir);

  console.log(`📄 Current CSV: ${newFile}`);
  console.log(`📄 Legacy CSV: ${legacyFile}`);

  const newData = parseCsv(newFile);
  const legacyData = parseCsv(legacyFile);

  const headers = newData.headers;
  const diffs = compare(newData.rows, legacyData.rows, headers);

  const compareDir = path.join(baseDir, 'logs', 'search-comparison', type, platform);
  fs.mkdirSync(compareDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const diffPath = path.join(compareDir, `comparison-${timestamp}.csv`);
  const diffCsv = toCsv(
    diffs.map((d) => ({ ...d, username: d.username || '(missing key)' })),
    ['username', 'field', 'legacy', 'current']
  );
  fs.writeFileSync(diffPath, diffCsv, 'utf8');

  console.log(`✅ Differences written to ${diffPath}`);
  const summary = diffs.reduce(
    (acc, d) => {
      if (d.field === '__presence') acc.presence++;
      else acc.value++;
      return acc;
    },
    { presence: 0, value: 0 }
  );
  console.log(`🔍 Summary: ${summary.presence} presence differences, ${summary.value} field value differences`);
}

main();
