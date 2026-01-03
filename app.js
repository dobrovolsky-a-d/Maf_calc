const BIN_STEP = 0.01;

let runs = [];
let mafTable = [];

/* ---------- parsers ---------- */

function parseCSV(text, cols) {
    return text.trim().split('\n').map(l => {
        const p = l.split(',').map(x => parseFloat(x.trim()));
        if (p.length < cols || p.some(isNaN)) return null;
        return p;
    }).filter(Boolean);
}

/* ---------- UI ---------- */

function addRun() {
    const text = document.getElementById('logInput').value;
    const data = parseCSV(text, 3);
    if (!data.length) {
        alert('Invalid log');
        return;
    }
    runs.push(data);
    document.getElementById('logInput').value = '';
    renderRuns();
}

function renderRuns() {
    const list = document.getElementById('runList');
    list.innerHTML = '';
    runs.forEach((r, i) => {
        const div = document.createElement('div');
        div.className = 'run-item';
        div.innerHTML = `Run ${i + 1} — ${r.length} rows <span onclick="removeRun(${i})">🗑️</span>`;
        list.appendChild(div);
    });
}

function removeRun(i) {
    runs.splice(i, 1);
    renderRuns();
}

/* ---------- calculation ---------- */

function calculateMAF() {
    const debug = document.getElementById('debug');
    debug.textContent = '';

    mafTable = parseCSV(document.getElementById('mafTableInput').value, 2);
    if (!mafTable.length || runs.length < 2) {
        alert('Missing MAF table or runs');
        return;
    }

    const mafMap = {};
    mafTable.forEach(([v, gs]) => mafMap[v.toFixed(2)] = gs);

    const bins = {};

    runs.flat().forEach(([v, afrMeas, afrTarget]) => {
        const key = (Math.round(v / BIN_STEP) * BIN_STEP).toFixed(2);
        if (!(key in mafMap)) return;

        const k = afrTarget / afrMeas;
        const newGs = mafMap[key] * k;

        if (!bins[key]) bins[key] = [];
        bins[key].push(newGs);
    });

    const result = Object.keys(bins).sort((a,b)=>a-b).map(v => {
        const oldGs = mafMap[v];
        const avgNew = bins[v].reduce((a,b)=>a+b,0) / bins[v].length;
        return {
            v,
            old: oldGs,
            new: avgNew,
            delta: ((avgNew / oldGs - 1) * 100)
        };
    });

    renderTable(result);

    debug.textContent += `Old MAF rows: ${mafTable.length}\n`;
    runs.forEach((r,i)=>debug.textContent+=`Run ${i+1}: ${r.length} samples\n`);
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
