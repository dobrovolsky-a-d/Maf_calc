/* =========================================================
   MAF Scaling – Open Loop
   Stable base version (no AFR filtering)
   ========================================================= */

/* ===== Column aliases (UNDER YOUR LOGS) ===== */

const COLUMN_MAP = {
    mafVoltage: [
        "mass airflow sensor voltage (v)"
    ],
    afrMeasured: [
        "aem uego wideband [9600 baud] (afr gasoline)"
    ],
    afrTarget: [
        "primary open loop map enrichment (estimated afr)",
        "primary open loop map enrichment (2-byte)** (estimated afr)"
    ],
    fuelingStatus: [
        "cl/ol fueling* (status)"
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
            `Required column not found in ${fileName}\n\n` +
            `Expected one of:\n- ${aliases.join('\n- ')}\n\n` +
            `Found columns:\n- ${headers.join('\n- ')}`
        );
    }

    if (matches.length > 1) {
        error(
            `Multiple matching columns in ${fileName}\n` +
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
    const statusCol = findColumn(headers, COLUMN_MAP.fuelingStatus, fileName);

    const samples = [];

    dataLines.forEach(line => {
        const p = line.split(',').map(x => parseFloat(x.trim()));
        if (p[statusCol] !== 10) return; // ONLY OPEN LOOP
        if ([p[vCol], p[afrCol], p[tgtCol]].some(isNaN)) return;
        samples.push([p[vCol], p[afrCol], p[tgtCol]]);
    });

    if (!samples.length) {
        error(`${fileName} contains no valid Open Loop samples`);
    }

    runs.push(samples);

    const div = document.createElement('div');
    div.className = 'run-item';
    div.textContent = `${fileName} — ${samples.length} OL samples`;
    document.getElementById('runList').appendChild(div);

    document.getElementById('debug').textContent +=
        `${fileName} loaded successfully\n`;
}

/* ===== Nearest MAF voltage mapping ===== */

function findNearestVoltage(v, axis) {
    let nearest = axis[0];
    let minDiff = Math.abs(v - nearest);

    for (let i = 1; i < axis.length; i++) {
        const diff = Math.abs(v - axis[i]);
        if (diff < minDiff) {
            minDiff = diff;
            nearest = axis[i];
        }
    }
    return nearest.toFixed(2);
}

/* ===== Main calculation ===== */

function calculateMAF() {
    const debug = document.getElementById('debug');
    debug.textContent = '';

    if (runs.length < 2) {
        error("At least 2 WOT Open Loop logs are required");
    }

    const vText = document.getElementById('mafVoltageInput').value.trim();
    const gsText = document.getElementById('mafGsInput').value.trim();

    if (!vText || !gsText) {
        error("MAF Voltage or Flow column is empty");
    }

    const vLines = vText.split('\n');
    const gsLines = gsText.split('\n');

    if (vLines.length !== gsLines.length) {
        error(
            "MAF Voltage and g/s column length mismatch\n" +
            `Voltage rows: ${vLines.length}\n` +
            `g/s rows: ${gsLines.length}`
        );
    }

    /* Build immutable MAF map */
    const mafMap = {};
    const mafAxis = [];

    for (let i = 0; i < vLines.length; i++) {
        const v = parseFloat(vLines[i].trim());
        const gs = parseFloat(gsLines[i].trim());
        if (isNaN(v) || isNaN(gs)) continue;

        const key = v.toFixed(2);
        mafMap[key] = gs;
        mafAxis.push(v);
    }

    if (!mafAxis.length) {
        error("No valid MAF rows found");
    }

    mafAxis.sort((a, b) => a - b);

    /* Collect corrections */
    const bins = {};

    runs.flat().forEach(([v, afrMeas, afrTarget]) => {
        const key = findNearestVoltage(v, mafAxis);
        const corrected = mafMap[key] * (afrMeas / afrTarget);
        bins[key] ??= [];
        bins[key].push(corrected);
    });

    /* Build result on original axis */
    const result = [];

    mafAxis.forEach(v => {
        const key = v.toFixed(2);
        const oldGs = mafMap[key];

        if (bins[key]) {
            const newGs =
                bins[key].reduce((a, b) => a + b, 0) / bins[key].length;

            result.push({
                v: key,
                old: oldGs,
                new: newGs,
                delta: (newGs / oldGs - 1) * 100
            });
        } else {
            result.push({
                v: key,
                old: oldGs,
                new: oldGs,
                delta: 0
            });
        }
    });

    renderTable(result);

    /* Status */
    debug.textContent += `MAF rows: ${mafAxis.length}\n`;
    runs.forEach((r, i) =>
        debug.textContent += `Run ${i + 1}: ${r.length} samples\n`
    );
    debug.textContent += `Bins with data: ${Object.keys(bins).length}\n`;
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
