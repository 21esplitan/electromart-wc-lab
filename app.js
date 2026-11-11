// Page code: loads the CSV files, calls the functions in ccc.js and fills in the page.
// All numbers come from the CSV files in data/. Nothing is typed in here.

async function loadCSV(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Could not load ' + path + ' (' + response.status + ')');
  return parseCSV(await response.text());
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

// Fill in the Before / After tables (no sliders involved).
function showTables(before, after, days) {
  const b = metrics(before, days);
  const a = metrics(after, days);
  for (const key of ['dio', 'dso', 'dpo', 'ccc']) {
    setText(key + '-before', fmtDays(b[key]));
    setText(key + '-after', fmtDays(a[key]));
  }
  setText('days-in-year', String(days));

  const freed = cashFreed(before, after);
  setText('inv-change', fmtDollars(before.inventory) + ' → ' + fmtDollars(after.inventory));
  setText('ar-change', fmtDollars(before.accounts_receivable) + ' → ' + fmtDollars(after.accounts_receivable));
  setText('ap-change', fmtDollars(before.accounts_payable) + ' → ' + fmtDollars(after.accounts_payable));
  setText('inv-freed', fmtDollars(freed.inventory));
  setText('ar-freed', fmtDollars(freed.receivables));
  setText('ap-freed', fmtDollars(freed.payables));
  setText('total-freed', fmtDollars(freed.total));
}

// Wire up the sliders and buttons.
function setupLevers(before, after, assumptions) {
  const days = assumptions.days_in_year;
  const b = metrics(before, days);
  const a = metrics(after, days);

  const sliders = {
    dio: document.getElementById('dio-slider'),
    dso: document.getElementById('dso-slider'),
    dpo: document.getElementById('dpo-slider'),
  };

  // Each slider runs from 0 to twice its Before days. step="any" keeps exact values.
  for (const key of ['dio', 'dso', 'dpo']) {
    sliders[key].max = Math.ceil(Math.max(b[key], a[key]) * 2);
    sliders[key].step = 'any';
  }

  setText('net-days', String(assumptions.net_days));
  setText('discount-label', fmtPercent(assumptions.supplier_discount).replace('.00%', '%'));

  function update() {
    const dioDays = sliders.dio.valueAsNumber;
    const dsoDays = sliders.dso.valueAsNumber;
    const dpoDays = sliders.dpo.valueAsNumber;
    setText('dio-value', fmtDays(dioDays) + ' days');
    setText('dso-value', fmtDays(dsoDays) + ' days');
    setText('dpo-value', fmtDays(dpoDays) + ' days');

    setText('lever-ccc', fmtDays(dioDays + dsoDays - dpoDays) + ' days');

    const implied = impliedBalances(before, dioDays, dsoDays, dpoDays, days);
    setText('lever-inv', fmtDollars(implied.inventory));
    setText('lever-ar', fmtDollars(implied.receivables));
    setText('lever-ap', fmtDollars(implied.payables));

    const freed = leverCashFreed(before, implied);
    setText('lever-inv-freed', fmtDollars(freed.inventory));
    setText('lever-ar-freed', fmtDollars(freed.receivables));
    setText('lever-ap-freed', fmtDollars(freed.payables));
    setText('lever-total-freed', fmtDollars(freed.total));

    const saved = interestSaved(freed.total, before.notes_payable, assumptions.bank_rate);
    setText('lever-interest', fmtDollars(saved));
    setText('interest-note', freed.total < 0
      ? 'Cash freed is negative, so ElectroMart must borrow more. The interest row shows the extra interest as a negative saving.'
      : 'The case’s own balance sheet shows ElectroMart kept part of its freed cash. This row assumes all of it, up to the Before bank line of ' +
        fmtDollars(before.notes_payable) + ', pays down the bank line at ' + fmtPercent(assumptions.bank_rate) + '.');

    setText('lever-past-due', fmtDays(daysPastDue(dpoDays, assumptions.net_days)) + ' days');

    const cost = discountCost(dpoDays, assumptions.supplier_discount, assumptions.discount_days, days);
    setText('lever-discount-cost', cost === null
      ? 'None (takes the discount)'
      : fmtPercent(cost));
  }

  function setSliders(m) {
    sliders.dio.value = m.dio;
    sliders.dso.value = m.dso;
    sliders.dpo.value = m.dpo;
    update();
  }

  for (const key of ['dio', 'dso', 'dpo']) sliders[key].addEventListener('input', update);
  document.getElementById('set-before').addEventListener('click', () => setSliders(b));
  document.getElementById('set-after').addEventListener('click', () => setSliders(a));

  setSliders(b); // start at Before
}

async function start() {
  try {
    const [statementRows, assumptionRows] = await Promise.all([
      loadCSV('data/electromart.csv'),
      loadCSV('data/assumptions.csv'),
    ]);
    const statements = statementsFromRows(statementRows);
    const assumptions = assumptionsFromRows(assumptionRows);
    showTables(statements.before, statements.after, assumptions.days_in_year);
    setupLevers(statements.before, statements.after, assumptions);
  } catch (err) {
    const box = document.getElementById('error');
    box.textContent = 'Something went wrong: ' + err.message +
      '. If you opened index.html from your computer, use the GitHub Pages address instead.';
    box.hidden = false;
  }
}

// Register the service worker so the app installs and works offline.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // The app still works without offline support.
    });
  });
}

start();
