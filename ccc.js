// Finance math for the cash conversion cycle (CCC).
// Plain functions only: nothing here touches the page, so Node can test them.

// Turn CSV text into a list of objects, one per row, keyed by the header names.
// Handles quoted fields so a comma inside a note does not split it.
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(f => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(f => f !== '')) rows.push(row);
  const header = rows.shift().map(h => h.trim());
  return rows.map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] || '').trim()])));
}

// electromart.csv -> { before: {revenue, cogs, inventory, ...}, after: {...} }
function statementsFromRows(rows) {
  const out = { before: {}, after: {} };
  for (const r of rows) {
    out.before[r.item] = Number(r.before);
    out.after[r.item] = Number(r.after);
  }
  return out;
}

// assumptions.csv -> { days_in_year: 365, bank_rate: 0.08, ... }
function assumptionsFromRows(rows) {
  const out = {};
  for (const r of rows) out[r.assumption] = Number(r.value);
  return out;
}

// DIO = Inventory / COGS x days in year
function dio(s, days) { return s.inventory / s.cogs * days; }
// DSO = Accounts receivable / Revenue x days in year (all sales are on credit)
function dso(s, days) { return s.accounts_receivable / s.revenue * days; }
// DPO = Accounts payable / COGS x days in year (purchases equal COGS)
function dpo(s, days) { return s.accounts_payable / s.cogs * days; }
// CCC = DIO + DSO - DPO
function ccc(s, days) { return dio(s, days) + dso(s, days) - dpo(s, days); }

// Day counts and CCC for one balance sheet.
function metrics(s, days) {
  return {
    dio: dio(s, days),
    dso: dso(s, days),
    dpo: dpo(s, days),
    ccc: ccc(s, days),
  };
}

// Cash freed by each lever, from the balance sheet change.
// A drop in an asset frees cash. A rise in accounts payable frees cash.
function cashFreed(before, after) {
  const inventory = before.inventory - after.inventory;
  const receivables = before.accounts_receivable - after.accounts_receivable;
  const payables = after.accounts_payable - before.accounts_payable;
  return { inventory, receivables, payables, total: inventory + receivables + payables };
}

// Cash freed from the days alone: days changed x annual COGS (or revenue) / days in year.
// Should equal the balance sheet change when revenue and COGS are the same in both periods.
function cashFreedFromDays(before, after, days) {
  const b = metrics(before, days), a = metrics(after, days);
  return {
    inventory: (b.dio - a.dio) * before.cogs / days,
    receivables: (b.dso - a.dso) * before.revenue / days,
    payables: (a.dpo - b.dpo) * before.cogs / days,
  };
}

// Show days with two decimals, dollars to the nearest dollar.
function fmtDays(x) { return x.toFixed(2); }
function fmtDollars(x) {
  const r = Math.round(x);
  const s = Math.abs(r).toLocaleString('en-US');
  return (r < 0 ? '-$' : '$') + s;
}

if (typeof module !== 'undefined') {
  module.exports = {
    parseCSV, statementsFromRows, assumptionsFromRows,
    dio, dso, dpo, ccc, metrics, cashFreed, cashFreedFromDays, fmtDays, fmtDollars,
  };
}
