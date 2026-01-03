const BIN_STEP = 0.01;

let runs = [];
let mafTable = [];

/* ---------- helpers ---------- */

function parseCSV(text, cols) {
    return text.trim().split('\n').map(line => {
        const v = line.split(',').map(x => parseFloat(x.trim()));
        if (v.length < cols || v.some(isNaN)) return null;
        return v;
    }).filter(Boolean);
}

/* ---------- runs ---------- */

function addRun() {
    const input = document.getElementById('logInput');
    const data = parseCSV(input.value, 3);

    if (!data.length) {
        alert('Invalid or empty log');
        return;
    }

    runs.push(data);
    input.value = '';
    renderRuns();
}

function renderRuns() {
    const list = document.getElementById('runList');
    list.innerHTML = '';

    runs.forEach((run, i) => {
        const div = document.createElement('div');
        div.className = 'run-item';
        div.innerHTML = `
            Run ${i + 1} — ${run.length} rows
            <span style="cursor:pointer" onclick="removeRun(${i})">🗑️</span>
        `;
        list.appendChild(div);
    });
}

function removeRun(i) {
    runs.splice(i, 1);
    renderRuns();
}

/* ---------- main calculation ---------- */

function calculateMAF() {
    const debug = document.getElementById('debug');
    debug.textContent = '';

    mafTable = parseCSV(document.getElementById('mafTableInput').value, 2);

    if (!mafTable.length) {
        alert('Old MAF table is missing');
        return;
    }
    if (runs.length < 2) {
        alert('Add at least 2 WOT runs');
        return;
    }

    // Map old MAF by voltage
    const mafMap = {};
    mafTable.forEach(([v, gs]) => {
        mafMap[v.toFixed(2)] = gs;
    });

    const bins = {};

    // Process all runs
    runs.flat().forEach(([v, afrMeas, afrTarget]) => {
        const key = (Math.round(v / BIN_STEP) * BIN_STEP).toFixed(2);
        if (!(key in mafMap)) return;

        const k = afrTarget / afrMeas;
        const corrected = mafMap[key] * k;

        if (!bins[key]) bins[key] = [];
        bins[key].push(corrected);
    });

    // Build result
    const result = Object.keys(bins)
        .sort((a, b) => a - b)
        .map(v => {
            const oldGs = mafMap[v];
            const newGs = bins[v].reduce((a, b) => a + b, 0) / bins[v].length;
            return {
                v,
                old: oldGs,
                new: newGs,
                delta: (newGs / oldGs - 1) * 100
            };
        });

    renderTable(result);

    // Debug info
    debug.textContent += `Old MAF rows: ${mafTable.length}\n`;
    runs.forEach((r, i) => {
        debug.textContent += `Run ${i + 1}: ${r.length} samples\n`;
    });
    debug.textContent += `Bins used: ${result.length}\n`;
}

/* ---------- output ---------- */

function renderTable(data) {
    const body = document.querySelector('#outputTable tbody');
    body.innerHTML = '';

    data.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.v}</td>
            <td>${r.old.toFixed(3)}</td>
            <td>${r.new.toFixed(3)}</td>
            <td>${r.delta.toFixed(1)}</td>
        `;
        body.appendChild(tr);
    });
}
