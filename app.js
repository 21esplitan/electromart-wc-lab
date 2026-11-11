// Page code: loads the CSV files, calls the functions in ccc.js and fills in the tables.
// All numbers come from the CSV files in data/. Nothing is typed in here.

async function loadCSV(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Could not load ' + path + ' (' + response.status + ')');
  return parseCSV(await response.text());
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

async function start() {
  try {
    const [statementRows, assumptionRows] = await Promise.all([
      loadCSV('data/electromart.csv'),
      loadCSV('data/assumptions.csv'),
    ]);
    const statements = statementsFromRows(statementRows);
    const assumptions = assumptionsFromRows(assumptionRows);
    const days = assumptions.days_in_year;
    const before = statements.before;
    const after = statements.after;

    // Days and CCC
    const b = metrics(before, days);
    const a = metrics(after, days);
    for (const key of ['dio', 'dso', 'dpo', 'ccc']) {
      setText(key + '-before', fmtDays(b[key]));
      setText(key + '-after', fmtDays(a[key]));
    }
    setText('days-in-year', String(days));

    // Cash freed by each lever
    const freed = cashFreed(before, after);
    setText('inv-change', fmtDollars(before.inventory) + ' → ' + fmtDollars(after.inventory));
    setText('ar-change', fmtDollars(before.accounts_receivable) + ' → ' + fmtDollars(after.accounts_receivable));
    setText('ap-change', fmtDollars(before.accounts_payable) + ' → ' + fmtDollars(after.accounts_payable));
    setText('inv-freed', fmtDollars(freed.inventory));
    setText('ar-freed', fmtDollars(freed.receivables));
    setText('ap-freed', fmtDollars(freed.payables));
    setText('total-freed', fmtDollars(freed.total));
  } catch (err) {
    const box = document.getElementById('error');
    box.textContent = 'Something went wrong: ' + err.message +
      '. If you opened index.html from your computer, use the GitHub Pages address instead.';
    box.hidden = false;
  }
}

start();
