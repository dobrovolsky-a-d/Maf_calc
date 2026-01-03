import { parseLog } from "./parseLog.js";
import { parseVE } from "./parseVE.js";
import { calculateVE } from "./veMath.js";
import { exportRomRaider } from "./exportRomRaider.js";

let logData = null;
let veOld = null;
let result = null;

const debug = document.getElementById("debug");
const output = document.getElementById("output");
const exportBtn = document.getElementById("export");

function setDebug(text) {
  debug.textContent = text;
}

// -------- LOAD LOG --------
document.getElementById("loadLog").addEventListener("change", async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;

    logData = await parseLog(file);
    setDebug(
      `Log loaded
Rows: ${logData.length}`
    );
  } catch (err) {
    setDebug("Log error:\n" + err.message);
    logData = null;
  }
});

// -------- LOAD VE --------
document.getElementById("loadVE").addEventListener("change", async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;

    veOld = await parseVE(file);
    setDebug(
      `VE loaded
Rows: ${veOld.rows}
Cols: ${veOld.cols}
Cells: ${veOld.rows * veOld.cols}`
    );
  } catch (err) {
    setDebug("VE error:\n" + err.message);
    veOld = null;
  }
});

// -------- CALCULATE --------
document.getElementById("calculate").addEventListener("click", () => {
  if (!logData || !veOld) {
    setDebug("Load log and VE table first");
    return;
  }

  try {
    result = calculateVE(logData, veOld);
    renderResult(result);

    exportBtn.disabled = false;

    const s = result.stats;
    setDebug(
      `VE TABLE:
Rows: ${s.veRows}
Cols: ${s.veCols}
Cells: ${s.veCells}

LOG:
Total rows: ${s.logRows}
Valid rows: ${s.validLogRows}
Used VE cells: ${s.usedCells}`
    );
  } catch (err) {
    setDebug("Calculation error:\n" + err.message);
  }
});

// -------- EXPORT --------
exportBtn.addEventListener("click", () => {
  if (!result) return;
  exportRomRaider(result.VE_new);
});

// -------- RENDER --------
function renderResult(res) {
  output.innerHTML = "";

  renderTable("Original VE", res.VE_old);
  renderTable("Correction %", res.Correction);
  renderTable("New VE", res.VE_new);
}

function renderTable(title, matrix) {
  const h = document.createElement("h3");
  h.textContent = title;
  output.appendChild(h);

  const table = document.createElement("table");

  matrix.forEach(row => {
    const tr = document.createElement("tr");
    row.forEach(val => {
      const td = document.createElement("td");
      td.textContent = Number(val).toFixed(2);
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  output.appendChild(table);
}
