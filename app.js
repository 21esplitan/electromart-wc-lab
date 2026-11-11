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

// Set text and color it green for a gain, red for a loss. Zero stays neutral.
function setSigned(id, text, value) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = Math.round(value) > 0 ? 'pos' : Math.round(value) < 0 ? 'neg' : '';
}

// Give a summary card a color: good, bad, warn or none.
function setKpi(valueId, text, tone) {
  const el = document.getElementById(valueId);
  el.textContent = text;
  el.parentElement.classList.remove('good', 'bad', 'warn');
  if (tone) el.parentElement.classList.add(tone);
}

// Bars for DIO + DSO (cash tied up) and DPO (supplier funding), for each row.
function drawChart(rows) {
  const scale = Math.max(...rows.map(r => Math.max(r.dio + r.dso, r.dpo)), 1);
  const pct = x => (Math.max(x, 0) / scale * 100).toFixed(2);
  document.getElementById('chart').innerHTML = rows.map(r => `
    <div class="bar-group">
      <div class="bar-title"><span>${r.label}</span><span>CCC ${fmtDays(r.dio + r.dso - r.dpo)} days</span></div>
      <div class="bar-line"><span class="bar-name">Cash tied up</span>
        <div class="bar-track"><div class="bar-seg seg-inv" style="width:${pct(r.dio)}%"></div><div class="bar-seg seg-ar" style="width:${pct(r.dso)}%"></div></div></div>
      <div class="bar-line"><span class="bar-name">Suppliers fund</span>
        <div class="bar-track"><div class="bar-seg seg-ap" style="width:${pct(r.dpo)}%"></div></div></div>
    </div>`).join('');
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
  setSigned('inv-freed', fmtDollars(freed.inventory), freed.inventory);
  setSigned('ar-freed', fmtDollars(freed.receivables), freed.receivables);
  setSigned('ap-freed', fmtDollars(freed.payables), freed.payables);
  setSigned('total-freed', fmtDollars(freed.total), freed.total);
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
  setText('net-days-kpi', String(assumptions.net_days));
  for (const key of ['dio', 'dso', 'dpo']) {
    setText(key + '-mark-before', fmtDays(b[key]));
    setText(key + '-mark-after', fmtDays(a[key]));
  }
  setText('discount-label', fmtPercent(assumptions.supplier_discount).replace('.00%', '%'));

  function update() {
    const dioDays = sliders.dio.valueAsNumber;
    const dsoDays = sliders.dso.valueAsNumber;
    const dpoDays = sliders.dpo.valueAsNumber;
    setText('dio-value', fmtDays(dioDays) + ' days');
    setText('dso-value', fmtDays(dsoDays) + ' days');
    setText('dpo-value', fmtDays(dpoDays) + ' days');

    const newCcc = dioDays + dsoDays - dpoDays;
    setText('lever-ccc', fmtDays(newCcc) + ' days');

    const implied = impliedBalances(before, dioDays, dsoDays, dpoDays, days);
    setText('lever-inv', fmtDollars(implied.inventory));
    setText('lever-ar', fmtDollars(implied.receivables));
    setText('lever-ap', fmtDollars(implied.payables));

    const freed = leverCashFreed(before, implied);
    setSigned('lever-inv-freed', fmtDollars(freed.inventory), freed.inventory);
    setSigned('lever-ar-freed', fmtDollars(freed.receivables), freed.receivables);
    setSigned('lever-ap-freed', fmtDollars(freed.payables), freed.payables);
    setSigned('lever-total-freed', fmtDollars(freed.total), freed.total);

    const saved = interestSaved(freed.total, before.notes_payable, assumptions.bank_rate);
    setSigned('lever-interest', fmtDollars(saved), saved);
    setText('interest-note', freed.total < 0
      ? 'Cash freed is negative, so ElectroMart must borrow more. The interest row shows the extra interest as a negative saving.'
      : 'The case’s own balance sheet shows ElectroMart kept part of its freed cash. This row assumes all of it, up to the Before bank line of ' +
        fmtDollars(before.notes_payable) + ', pays down the bank line at ' + fmtPercent(assumptions.bank_rate) + '.');

    const pastDue = daysPastDue(dpoDays, assumptions.net_days);
    setText('lever-past-due', fmtDays(pastDue) + ' days');
    document.getElementById('lever-past-due').className = pastDue > 0 ? 'warn-text' : '';

    const cost = discountCost(dpoDays, assumptions.supplier_discount, assumptions.discount_days, days);
    setText('lever-discount-cost', cost === null
      ? 'None (takes the discount)'
      : fmtPercent(cost));
    document.getElementById('lever-discount-cost').className = cost === null ? 'pos' : '';

    // Summary cards
    const change = newCcc - b.ccc;
    setKpi('kpi-ccc', fmtDays(newCcc) + ' days', null);
    setText('kpi-ccc-sub', Math.abs(change) < 0.005 ? 'same as Before'
      : fmtDays(Math.abs(change)) + ' days ' + (change < 0 ? 'shorter' : 'longer') + ' than Before');
    setKpi('kpi-freed', fmtDollars(freed.total), Math.round(freed.total) > 0 ? 'good' : Math.round(freed.total) < 0 ? 'bad' : null);
    setKpi('kpi-interest', fmtDollars(saved), Math.round(saved) > 0 ? 'good' : Math.round(saved) < 0 ? 'bad' : null);
    setKpi('kpi-past-due', fmtDays(pastDue) + ' days', pastDue > 0 ? 'warn' : null);

    drawChart([
      { label: 'Before', dio: b.dio, dso: b.dso, dpo: b.dpo },
      { label: 'After', dio: a.dio, dso: a.dso, dpo: a.dpo },
      { label: 'Your levers', dio: dioDays, dso: dsoDays, dpo: dpoDays },
    ]);
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
