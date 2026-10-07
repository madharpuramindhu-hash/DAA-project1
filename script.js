/* LCS Text Comparison Tool
   Dynamic programming: O(n*m) time and space. */

const MAX_TOKENS = 4000;     // per document, keeps the table at ~16M cells max
const MAX_TABLE = 18;        // largest size at which the DP table is drawn

const $ = (id) => document.getElementById(id);
const els = {
  a: $("textA"), b: $("textB"),
  ignoreCase: $("ignoreCase"), ignorePunct: $("ignorePunct"),
  msg: $("message"), results: $("results"),
  stats: $("stats"), outA: $("outA"), outB: $("outB"),
  tableWrap: $("tableWrap"), tableNote: $("tableNote"),
};

const SAMPLE_A = `The quick brown fox jumps over the lazy dog.
Algorithms are step by step procedures for solving problems.
Dynamic programming stores the results of subproblems so they are not computed again.`;
const SAMPLE_B = `The quick red fox leaps over the lazy dog.
Algorithms are procedures for solving problems step by step.
Dynamic programming stores results of subproblems so they are never computed again.`;

/* ---------- tokenising ---------- */
function getMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

function tokenize(text, mode) {
  if (mode === "line") return text.split(/\r?\n/);
  if (mode === "char") return Array.from(text);
  return text.match(/\S+/g) || [];
}

function normalise(token, mode) {
  let t = token;
  if (els.ignoreCase.checked) t = t.toLowerCase();
  if (els.ignorePunct.checked) t = t.replace(/[^\p{L}\p{N}\s]/gu, "");
  if (mode === "line") t = t.trim();
  return t;
}

/* ---------- LCS (dynamic programming) ---------- */
function buildTable(a, b) {
  const n = a.length, m = b.length, w = m + 1;
  const dp = new Uint16Array((n + 1) * w);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i * w + j] = a[i - 1] === b[j - 1]
        ? dp[(i - 1) * w + (j - 1)] + 1
        : Math.max(dp[(i - 1) * w + j], dp[i * w + (j - 1)]);
    }
  }
  return dp;
}

function traceback(dp, a, b) {
  const w = b.length + 1;
  let i = a.length, j = b.length;
  const pairs = [];      // matched index pairs [i, j] (0-based)
  const path = new Set(); // cells visited, as "i,j"
  path.add(i + "," + j);
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      pairs.push([i - 1, j - 1]);
      i--; j--;
    } else if (dp[(i - 1) * w + j] >= dp[i * w + (j - 1)]) {
      i--;
    } else {
      j--;
    }
    path.add(i + "," + j);
  }
  pairs.reverse();
  return { pairs, path };
}

/* ---------- rendering ---------- */
function renderDoc(container, raw, matchedIdx, mode, side) {
  container.innerHTML = "";
  const frag = document.createDocumentFragment();
  raw.forEach((tok, idx) => {
    const span = document.createElement("span");
    const pairId = matchedIdx.get(idx);
    span.className = "t " + (pairId !== undefined ? "same" : side === "a" ? "del" : "add");
    span.textContent = tok === "" && mode === "line" ? " " : tok;
    if (pairId !== undefined) span.dataset.pair = pairId;

    if (mode === "line") {
      const row = document.createElement("div");
      row.className = "line-row";
      row.appendChild(span);
      frag.appendChild(row);
    } else {
      frag.appendChild(span);
      if (mode === "word" && idx < raw.length - 1) frag.appendChild(document.createTextNode(" "));
    }
  });
  container.appendChild(frag);
}

function renderStats(n, m, lcs) {
  const dice = n + m === 0 ? 100 : (2 * lcs / (n + m)) * 100;
  const ofLonger = Math.max(n, m) === 0 ? 100 : (lcs / Math.max(n, m)) * 100;
  const unit = { word: "words", char: "characters", line: "lines" }[getMode()];
  els.stats.innerHTML = `
    <div class="stat big"><b>${dice.toFixed(1)}%</b><span>Similarity (2 × LCS ÷ (n + m))</span></div>
    <div class="stat"><b>${lcs}</b><span>LCS length (${unit})</span></div>
    <div class="stat"><b>${n - lcs}</b><span>Removed from A</span></div>
    <div class="stat"><b>${m - lcs}</b><span>Added in B</span></div>
    <div class="stat"><b>${ofLonger.toFixed(1)}%</b><span>LCS ÷ longer document</span></div>
    <div class="stat"><b>${n} × ${m}</b><span>Table size (n × m)</span></div>`;
}

function renderTable(dp, rawA, rawB, a, b, path) {
  const n = a.length, m = b.length, w = m + 1;
  if (n > MAX_TABLE || m > MAX_TABLE) {
    els.tableWrap.innerHTML = "";
    els.tableNote.textContent =
      `The table has ${(n + 1) * (m + 1)} cells, which is too large to draw. Use shorter texts (up to ${MAX_TABLE} tokens each) to see it.`;
    return;
  }
  els.tableNote.textContent =
    "Each cell holds the LCS length for the tokens before it. Green cells are matches; the blue outline is the path read back from the bottom-right corner to recover the LCS.";
  const short = (s) => (s === "" ? "(blank)" : s);
  let html = "<table><thead><tr><th></th><th>∅</th>";
  rawB.forEach((t) => (html += `<th title="${t.replace(/"/g, "&quot;")}">${escapeHtml(short(t))}</th>`));
  html += "</tr></thead><tbody>";
  for (let i = 0; i <= n; i++) {
    html += `<tr><th>${i === 0 ? "∅" : escapeHtml(short(rawA[i - 1]))}</th>`;
    for (let j = 0; j <= m; j++) {
      const isMatch = i > 0 && j > 0 && a[i - 1] === b[j - 1];
      const cls = [isMatch ? "match" : "", path.has(i + "," + j) ? "path" : ""].join(" ").trim();
      html += `<td class="${cls}">${dp[i * w + j]}</td>`;
    }
    html += "</tr>";
  }
  html += "</tbody></table>";
  els.tableWrap.innerHTML = html;
}

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function showMessage(text) {
  els.msg.textContent = text;
  els.msg.hidden = !text;
}

/* ---------- main ---------- */
function compare() {
  const mode = getMode();
  const rawA = tokenize(els.a.value, mode);
  const rawB = tokenize(els.b.value, mode);

  if (!els.a.value.trim() && !els.b.value.trim()) {
    els.results.hidden = true;
    showMessage("Enter text in both boxes, or choose Load sample.");
    return;
  }
  if (rawA.length > MAX_TOKENS || rawB.length > MAX_TOKENS) {
    els.results.hidden = true;
    showMessage(`Each document can have at most ${MAX_TOKENS} ${mode}s in this mode. Try comparing by words or lines.`);
    return;
  }
  showMessage("");

  const a = rawA.map((t) => normalise(t, mode));
  const b = rawB.map((t) => normalise(t, mode));

  const dp = buildTable(a, b);
  const { pairs, path } = traceback(dp, a, b);

  const mapA = new Map(), mapB = new Map();
  pairs.forEach(([i, j], k) => { mapA.set(i, k); mapB.set(j, k); });

  els.results.hidden = false;
  renderStats(a.length, b.length, pairs.length);
  renderDoc(els.outA, rawA, mapA, mode, "a");
  renderDoc(els.outB, rawB, mapB, mode, "b");
  renderTable(dp, rawA, rawB, a, b, path);
}

/* hover a common token: highlight its partner in the other document */
function hoverPair(e, on) {
  const t = e.target.closest(".t.same");
  if (!t) return;
  document.querySelectorAll(`.t.same[data-pair="${t.dataset.pair}"]`)
    .forEach((n) => n.classList.toggle("hot", on));
}
[els.outA, els.outB].forEach((box) => {
  box.addEventListener("mouseover", (e) => hoverPair(e, true));
  box.addEventListener("mouseout", (e) => hoverPair(e, false));
});

$("compareBtn").addEventListener("click", compare);
$("sampleBtn").addEventListener("click", () => {
  els.a.value = SAMPLE_A; els.b.value = SAMPLE_B; compare();
});
$("swapBtn").addEventListener("click", () => {
  [els.a.value, els.b.value] = [els.b.value, els.a.value];
  if (!els.results.hidden) compare();
});
$("clearBtn").addEventListener("click", () => {
  els.a.value = ""; els.b.value = "";
  els.results.hidden = true; showMessage("");
});
document.querySelectorAll('input[name="mode"], #ignoreCase, #ignorePunct').forEach((c) =>
  c.addEventListener("change", () => { if (!els.results.hidden) compare(); })
);