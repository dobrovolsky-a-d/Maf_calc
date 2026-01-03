const BIN_STEP = 0.01;

/* ===== Column definitions ===== */

const COLUMN_MAP = {
    mafVoltage: [
        "maf voltage",
        "maf sensor voltage",
        "maf v"
    ],
    afrMeasured: [
        "afr",
        "wideband afr",
        "afr measured",
        "air fuel ratio"
    ],
    afrTarget: [
        "afr target",
        "target afr",
        "commanded afr"
    ]
};

let runs = [];

/* ===== Helpers ===== */

function normalize(s) {
    return s.toLowerCase().trim();
}

function error(msg) {
    const dbg = document.getElementById('debug');
    dbg.textContent = "ERROR:\n" + msg;
    throw new Error(msg);
}

function warn(msg) {
    const dbg = document.getElementById('debug');
    dbg.textContent += "\nWARNING:\n" + msg + "\n";
}

/* ===== CSV parsing ===== */

function parseCSVWithHeader(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) error("CSV file has no data rows");

    const headers = lines[0].split(',').map(normalize);
    const dataLines = lines.slice(1);

    return { headers, dataLines };
}

function findColumn(headers, aliases, fileName) {
    const matches = headers
        .map((h, i) => aliases.includes(h) ? i : -1)
        .filter(i => i !== -1);

    if (matches.length === 0) {
        error(
            `Required column not found in ${fileName}\n` +
            `Expected one of:\n- ${aliases.join('\n- ')}\n\n` +
            `Found columns:\n- ${headers.join('\n- ')}`
        );
    }

    if (matches.length > 1) {
        error(
            `Multiple matching columns in ${fileName}\n` +
            `Matches indices: ${matches.join(', ')}\n` +
            `Please keep only one channel`
        );
    }

    return matches[0];
}

/* ===== Load log files ===== */

document.getElementById('logFiles').addEventListener('change', e => {
    runs = [];
    document.getElementById('runList').innerHTML = '';
    document.getElementById('debug').textContent = '';

    [...e.target.files].forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => loadLog(file.name, ev.target.result);
        reader.readAsText(file);
    });
});

function loadLog(fileName, text) {
    const { headers, dataLines } = parseCSVWithHeader(text);

    const vCol = findColumn(headers, COLUMN_MAP.mafVoltage, fileName);
    const afrCol = findColumn(headers, COLUMN_MAP.afrMeasured, fileName);
    const tgtCol = findColumn(headers, COLUMN_MAP.afrTarget, fileName);

    const samples = [];

    dataLines.forEach(line => {
        const p = line.split(',').map(x => parseFloat(x.trim()));
        if ([p[vCol], p[afrCol], p[tgtCol]].some(isNaN)) return;
        samples.push([p[vCol], p[afrCol], p[tgtCol]]);
    });

    if (!samples.length) {
        error(`${fileName} contains no valid samples`);
    }

    runs.push(samples);

    const div = document.createElement('div');
    div.className = 'run-item';
    div.textContent = `${fileName} — ${samples.length} samples`;
    document.getElementById('runList').appendChild(div);

    document.getElementById('debug').textContent +=
        `${fileName} loaded successfully\n`;
}

/* ===== Main calculation ===== */

function calculateMAF() {
    const debug = document.getElementById('debug');
    debug.textContent = '';

    if (runs.length < 2) {
        error("At least 2 WOT log files are required");
    }

    const mafText = document.getElementById('mafTableInput').value.trim();
    if (!mafText) error("Old MAF table is empty");

    const mafLines = mafText.split('\n');
    const mafMap = {};

    mafLines.forEach(line => {
        const p = line.split(',').map(x => parseFloat(x.trim()));
        if (p.length < 2 || p.some(isNaN)) return;
        mafMap[p[0].toFixed(2)] = p[1];
    });

    if (!Object.keys(mafMap).length) {
        error("Old MAF table contains no valid rows");
    }

    const bins = {};

    runs.flat().forEach(([v, afrMeas, afrTarget]) => {
        const key = (Math.round(v / BIN_STEP) * BIN_STEP).toFixed(2);
        if (!(key in mafMap)) return;

        const corrected = mafMap[key] * (afrTarget / afrMeas);
        bins[key] ??= [];
        bins[key].push(corrected);
    });

    const keys = Object.keys(bins);
    if (!keys.length) {
        error(
            "No overlapping voltage bins between logs and MAF table\n" +
            `Log range and MAF range do not intersect`
        );
    }

    const result = keys.sort((a,b)=>a-b).map(v => {
        const oldGs = mafMap[v];
        const newGs = bins[v].reduce((a,b)=>a+b,0) / bins[v].length;
        return {
            v,
            old: oldGs,
            new: newGs,
            delta: (newGs / oldGs - 1) * 100
        };
    });

    renderTable(result);

    debug.textContent += `Old MAF rows: ${Object.keys(mafMap).length}\n`;
    runs.forEach((r,i)=>debug.textContent+=`Run ${i+1}: ${r.length} samples\n`);
    debug.textContent += `Bins used: ${result.length}\n`;
    debug.textContent += `Calculation completed successfully\n`;
}

/* ===== Output ===== */

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
