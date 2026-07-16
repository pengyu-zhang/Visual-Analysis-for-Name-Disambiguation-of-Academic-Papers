/* Minimal CSV parser/serializer (RFC 4180-ish: quoted fields, embedded
 * commas/quotes/newlines). No external dependencies. */
const CSV = {
  parse(text) {
    const rows = [];
    let row = [], field = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    if (!rows.length) return [];
    const header = rows[0].map(h => h.trim());
    return rows.slice(1).map(r => {
      const obj = {};
      header.forEach((h, i) => { obj[h] = (r[i] ?? "").trim(); });
      return obj;
    });
  },

  stringify(records, columns) {
    const esc = v => {
      v = String(v ?? "");
      return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    const lines = [columns.join(",")];
    for (const rec of records) lines.push(columns.map(c => esc(rec[c])).join(","));
    return lines.join("\r\n");
  },
};
