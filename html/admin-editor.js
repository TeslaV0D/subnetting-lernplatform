/* ════════════════════════════════════════════════════════════
   ADMIN QUESTION MANAGER  –  Logik
   Erwartet aus index.html (global): API_BASE, esc()
   ════════════════════════════════════════════════════════════ */

// ─── Zustand ───────────────────────────────────────────────
let adminToken      = sessionStorage.getItem('sn_admin_token') || null;
let adminQuestions  = [];                 // vom Server geladen (inkl. stats)
let editorId        = null;               // null = neue Frage, sonst Frage-ID
let editorDifficulty= 2;
let adminView       = 'results';          // 'results' | 'questions'
let selectedIds     = new Set();
let lastDeleted     = null;               // { question, timer } für Undo

const filterState = { type: '', category: '', difficulty: '', search: '' };
const sortState   = { col: 'created', dir: 'desc' };
const pageState   = { page: 1, size: 10 };

// ─── Auth-Helfer ───────────────────────────────────────────
function authHeaders(extra) {
  const h = Object.assign({}, extra || {});
  if (adminToken) h['Authorization'] = 'Bearer ' + adminToken;
  return h;
}

async function adminLogin() {
  const p   = document.getElementById('admin-pass').value;
  const err = document.getElementById('login-err');
  err.textContent = '';
  try {
    const resp = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: p })
    });
    if (!resp.ok) {
      err.textContent = 'Falscher Benutzername oder Passwort.';
      return;
    }
    const data = await resp.json();
    adminToken = data.token;
    sessionStorage.setItem('sn_admin_token', adminToken);
    document.getElementById('admin-login-wrap').style.display = 'none';
    document.getElementById('admin-panel').classList.add('visible');
    document.getElementById('admin-pass').value = '';
    switchAdminView('results');
  } catch (e) {
    err.textContent = 'Server nicht erreichbar.';
  }
}

function adminLogout() {
  adminToken = null;
  sessionStorage.removeItem('sn_admin_token');
  document.getElementById('admin-login-wrap').style.display = '';
  document.getElementById('admin-panel').classList.remove('visible');
  document.getElementById('admin-pass').value = '';
  document.getElementById('login-err').textContent = '';
}

// von showPage('admin') in index.html aufgerufen
async function renderAdmin() {
  if (!document.getElementById('admin-panel').classList.contains('visible')) {
    // Falls Token aus früherer Session vorhanden: direkt einloggen
    if (adminToken) {
      document.getElementById('admin-login-wrap').style.display = 'none';
      document.getElementById('admin-panel').classList.add('visible');
    } else {
      return;
    }
  }
  if (adminView === 'results') await renderResultsView();
  else await renderQuestionManager();
}

function switchAdminView(view) {
  adminView = view;
  document.querySelectorAll('.admin-switch button').forEach(b =>
    b.classList.toggle('active', b.dataset.view === view));
  document.getElementById('view-results').classList.toggle('active', view === 'results');
  document.getElementById('view-questions').classList.toggle('active', view === 'questions');
  renderAdmin();
}

// ═══════════════════════════════════════════════════════════
//  ERGEBNISSE-VIEW  (Statistik + Tabelle + Heatmap)
// ═══════════════════════════════════════════════════════════
async function renderResultsView() {
  let results = [];
  try {
    const resp = await fetch(`${API_BASE}/results`, { headers: authHeaders() });
    if (resp.status === 401) { adminLogout(); return; }
    if (resp.ok) results = await resp.json();
  } catch (e) { results = []; }

  const total  = results.length;
  const passed = results.filter(r => r.score >= 60).length;
  const avg    = total ? Math.round(results.reduce((s, r) => s + r.score, 0) / total) : 0;
  const unique = new Set(results.map(r => r.name)).size;

  document.getElementById('admin-stats-row').innerHTML = `
    <div class="a-stat"><div class="lbl">Tests gesamt</div><div class="val val-blue">${total}</div></div>
    <div class="a-stat"><div class="lbl">Bestanden</div><div class="val val-good">${passed}</div></div>
    <div class="a-stat"><div class="lbl">Ø Punkte</div><div class="val">${avg}%</div></div>
    <div class="a-stat"><div class="lbl">Teilnehmer</div><div class="val val-blue">${unique}</div></div>`;

  const tbody = document.getElementById('results-tbody');
  if (results.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="ti ti-clipboard-off"></i>Noch keine Testergebnisse vorhanden.</div></td></tr>`;
  } else {
    tbody.innerHTML = results.map((r, i) => `
      <tr>
        <td class="name-cell">${esc(r.name)}</td>
        <td class="mono">${esc(r.time)}</td>
        <td class="mono"><strong style="color:${r.score >= 60 ? 'var(--green-text)' : 'var(--red-text)'}">${r.score}%</strong></td>
        <td class="mono">${r.correct}/${r.total}</td>
        <td><span class="badge ${r.passed ? 'pass' : 'fail'}">${r.passed ? 'Bestanden' : 'Nicht bestanden'}</span></td>
        <td class="mono">${esc(r.duration || '–')}</td>
        <td><button class="detail-btn" onclick="toggleDetail('detail-${i}')">Details</button></td>
      </tr>
      <tr id="detail-${i}" style="display:none">
        <td colspan="7">
          <div class="detail-drawer open">
            ${r.wrong && r.wrong.length > 0
              ? `<strong style="color:var(--text2);font-size:12px">Falsch beantwortet:</strong>
                 <div class="wrong-list">
                   ${r.wrong.map(w => `
                     <div class="dw-item">
                       <span style="color:var(--text2)">${esc(w.q || '–')}</span><br>
                       <span style="color:var(--red-text)">✗ ${esc(w.your || '–')}</span>
                       &nbsp;→&nbsp;
                       <span style="color:var(--green-text)">✓ ${esc(w.correct || '–')}</span>
                     </div>`).join('')}
                 </div>`
              : '<span style="color:var(--green-text)">✓ Alle Fragen richtig beantwortet!</span>'}
          </div>
        </td>
      </tr>`).join('');
  }

  // Heatmap
  const hm = document.getElementById('error-heatmap');
  const errMap = {};
  results.forEach(r => { if (r.wrong) r.wrong.forEach(w => { errMap[w.q] = (errMap[w.q] || 0) + 1; }); });
  const sortedErrs = Object.entries(errMap).sort((a, b) => b[1] - a[1]);
  hm.innerHTML = sortedErrs.length === 0
    ? '<div class="empty-state"><i class="ti ti-check"></i>Keine Fehler bisher.</div>'
    : sortedErrs.map(([q, cnt]) => `
        <div class="q-admin-item">
          <div class="q-admin-text">${esc(q)}</div>
          <span class="err-count">${cnt}×</span>
        </div>`).join('');
}

function toggleDetail(id) {
  const row = document.getElementById(id);
  if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
}

async function clearResults() {
  if (!confirm('Alle Testergebnisse wirklich löschen?')) return;
  try {
    const r = await fetch(`${API_BASE}/results`, { method: 'DELETE', headers: authHeaders() });
    if (r.ok) { toast('Alle Ergebnisse gelöscht.', 'ok'); renderResultsView(); }
    else toast('Löschen fehlgeschlagen.', 'err');
  } catch (e) { toast('Server nicht erreichbar.', 'err'); }
}

async function exportResults() {
  try {
    const resp = await fetch(`${API_BASE}/results/export`, { headers: authHeaders() });
    downloadBlob(await resp.blob(), 'subnetting-results.json');
  } catch (e) { toast('Export fehlgeschlagen.', 'err'); }
}

// ═══════════════════════════════════════════════════════════
//  FRAGEN-MANAGER
// ═══════════════════════════════════════════════════════════
async function loadQuestions() {
  const resp = await fetch(`${API_BASE}/questions`, { headers: authHeaders() });
  if (resp.status === 401) { adminLogout(); throw new Error('unauth'); }
  if (!resp.ok) throw new Error('load failed');
  adminQuestions = await resp.json();
}

async function renderQuestionManager() {
  const listBody = document.getElementById('qm-tbody');
  if (listBody) listBody.innerHTML = `<tr><td colspan="6"><div class="qm-loading"><span class="spinner"></span>Lade Fragen…</div></td></tr>`;
  try {
    await loadQuestions();
  } catch (e) {
    if (e.message !== 'unauth' && listBody)
      listBody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="ti ti-plug-off"></i>Server nicht erreichbar.</div></td></tr>`;
    return;
  }
  refreshCategoryFilter();
  renderTable();
  renderStatBar();
}

// Kategorien aus Fragen ableiten (+ evtl. gespeicherte Custom-Kategorien)
function allCategories() {
  const fromQ = adminQuestions.map(q => q.category).filter(Boolean);
  const custom = JSON.parse(localStorage.getItem('sn_categories') || '[]');
  return [...new Set([...fromQ, ...custom])].sort((a, b) => a.localeCompare(b, 'de'));
}

function refreshCategoryFilter() {
  const sel = document.getElementById('qm-filter-cat');
  const cur = sel.value;
  const cats = allCategories();
  sel.innerHTML = `<option value="">Alle Kategorien</option>` +
    cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  sel.value = cats.includes(cur) ? cur : '';
  // Datalist im Editor aktualisieren
  const dl = document.getElementById('cat-datalist');
  if (dl) dl.innerHTML = cats.map(c => `<option value="${esc(c)}">`).join('');
}

function getFilteredSorted() {
  let list = adminQuestions.filter(q => {
    if (filterState.type && q.type !== filterState.type) return false;
    if (filterState.category && q.category !== filterState.category) return false;
    if (filterState.difficulty && String(q.difficulty) !== filterState.difficulty) return false;
    if (filterState.search) {
      const s = filterState.search.toLowerCase();
      const hay = (q.text + ' ' + (q.ip || '') + ' ' + (q.explain || '') + ' ' + q.category).toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });
  const dir = sortState.dir === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    let va, vb;
    switch (sortState.col) {
      case 'type':    va = a.type; vb = b.type; break;
      case 'text':    va = a.text.toLowerCase(); vb = b.text.toLowerCase(); break;
      case 'category':va = a.category.toLowerCase(); vb = b.category.toLowerCase(); break;
      case 'difficulty': va = a.difficulty; vb = b.difficulty; break;
      case 'rate':    va = a.stats?.errorRate || 0; vb = b.stats?.errorRate || 0; break;
      default:        va = a.createdAt || 0; vb = b.createdAt || 0;
    }
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
  return list;
}

function starString(n) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += i <= n ? '★' : '<span class="off">★</span>';
  return `<span class="stars">${s}</span>`;
}

const TYPE_LABEL = { mc: 'MC', freetext: 'FT', order: 'ORD' };
const TYPE_CLASS = { mc: 'mc', freetext: 'ft', order: 'ord' };

function renderTable() {
  const all = getFilteredSorted();
  const totalPages = Math.max(1, Math.ceil(all.length / pageState.size));
  if (pageState.page > totalPages) pageState.page = totalPages;
  const start = (pageState.page - 1) * pageState.size;
  const pageItems = all.slice(start, start + pageState.size);

  const tbody = document.getElementById('qm-tbody');
  if (all.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="ti ti-search-off"></i>Keine Fragen gefunden.</div></td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map(q => {
      const rate = q.stats?.errorRate || 0;
      const attempted = q.stats?.attempted || 0;
      const rateCls = rate > 0.3 ? 'high' : (rate > 0.15 ? 'mid' : '');
      const rateTxt = attempted ? Math.round(rate * 100) + '%' : '–';
      return `
      <tr class="${editorId === q.id ? 'editing-row' : ''} ${selectedIds.has(q.id) ? 'selected-row' : ''}" onclick="selectQuestion('${q.id}')">
        <td class="col-check" onclick="event.stopPropagation()">
          <input type="checkbox" ${selectedIds.has(q.id) ? 'checked' : ''} onchange="toggleSelect('${q.id}', this.checked)">
        </td>
        <td><span class="type-badge ${TYPE_CLASS[q.type]}">${TYPE_LABEL[q.type]}</span></td>
        <td><span class="qm-q-text" title="${esc(q.text)}">${esc(q.text)}</span>${q.ip ? `<span class="qm-q-ip">${esc(q.ip)}</span>` : ''}</td>
        <td><span class="cat-chip">${esc(q.category)}</span></td>
        <td>${starString(q.difficulty)}</td>
        <td><span class="rate-pill ${rateCls}" title="${q.stats?.errors || 0} Fehler bei ${attempted} Versuchen">${rateTxt}</span></td>
      </tr>`;
    }).join('');
  }

  // Sort-Indikatoren
  document.querySelectorAll('.qm-table th.sortable').forEach(th => {
    const ind = th.querySelector('.sort-ind');
    if (ind) ind.textContent = th.dataset.col === sortState.col ? (sortState.dir === 'asc' ? '▲' : '▼') : '';
  });

  // Pagination
  document.getElementById('qm-page-info').textContent =
    all.length ? `${start + 1}–${Math.min(start + pageState.size, all.length)} von ${all.length}` : '0 von 0';
  document.getElementById('qm-prev').disabled = pageState.page <= 1;
  document.getElementById('qm-next').disabled = pageState.page >= totalPages;

  renderBulkBar();
}

function renderBulkBar() {
  const bar = document.getElementById('qm-bulk');
  if (selectedIds.size === 0) { bar.classList.remove('show'); return; }
  bar.classList.add('show');
  document.getElementById('qm-bulk-count').textContent = selectedIds.size;
}

function renderStatBar() {
  const total = adminQuestions.length;
  const easy = adminQuestions.filter(q => q.difficulty <= 2).length;
  const mid  = adminQuestions.filter(q => q.difficulty === 3).length;
  const hard = adminQuestions.filter(q => q.difficulty >= 4).length;
  const cats = allCategories().length;
  document.getElementById('qm-statbar').innerHTML = `
    <div class="qm-stat"><div class="v">${total}</div><div class="l">Fragen gesamt</div></div>
    <div class="qm-stat easy"><div class="v">${easy}</div><div class="l">Einfach (1–2)</div></div>
    <div class="qm-stat mid"><div class="v">${mid}</div><div class="l">Mittel (3)</div></div>
    <div class="qm-stat hard"><div class="v">${hard}</div><div class="l">Schwer (4–5)</div></div>
    <div class="qm-stat"><div class="v">${cats}</div><div class="l">Kategorien</div></div>`;
}

// ─── Filter / Sort / Pagination Events ─────────────────────
function onFilterChange() {
  filterState.type       = document.getElementById('qm-filter-type').value;
  filterState.category   = document.getElementById('qm-filter-cat').value;
  filterState.difficulty = document.getElementById('qm-filter-diff').value;
  filterState.search     = document.getElementById('qm-search').value.trim();
  pageState.page = 1;
  renderTable();
}
function sortByCol(col) {
  if (sortState.col === col) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
  else { sortState.col = col; sortState.dir = 'asc'; }
  renderTable();
}
function changePage(delta) { pageState.page += delta; renderTable(); }
function changePageSize() { pageState.size = Number(document.getElementById('qm-page-size').value); pageState.page = 1; renderTable(); }

// ─── Auswahl / Bulk ────────────────────────────────────────
function toggleSelect(id, checked) {
  if (checked) selectedIds.add(id); else selectedIds.delete(id);
  renderTable();
}
function toggleSelectAllVisible(checked) {
  const visible = getFilteredSorted().slice((pageState.page - 1) * pageState.size, pageState.page * pageState.size);
  visible.forEach(q => { if (checked) selectedIds.add(q.id); else selectedIds.delete(q.id); });
  renderTable();
}
function clearSelection() { selectedIds.clear(); renderTable(); }

async function bulkDelete() {
  if (selectedIds.size === 0) return;
  if (!confirm(`${selectedIds.size} Frage(n) wirklich löschen?`)) return;
  try {
    const r = await fetch(`${API_BASE}/questions/bulk-delete`, {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ids: [...selectedIds] })
    });
    const d = await r.json();
    if (r.ok) {
      toast(`${d.removed} Frage(n) gelöscht.`, 'ok');
      if (selectedIds.has(editorId)) newQuestion();
      selectedIds.clear();
      renderQuestionManager();
    } else toast(d.error || 'Fehler.', 'err');
  } catch (e) { toast('Server nicht erreichbar.', 'err'); }
}

async function bulkSetCategory() {
  const cat = document.getElementById('qm-bulk-cat').value.trim();
  if (!cat || selectedIds.size === 0) { toast('Kategorie eingeben.', 'warn'); return; }
  await bulkPatch({ category: cat }, `Kategorie auf „${cat}" gesetzt.`);
}
async function bulkSetDifficulty() {
  const diff = document.getElementById('qm-bulk-diff').value;
  if (!diff || selectedIds.size === 0) return;
  await bulkPatch({ difficulty: Number(diff) }, `Schwierigkeit auf ${diff} gesetzt.`);
}
async function bulkPatch(patch, okMsg) {
  try {
    const r = await fetch(`${API_BASE}/questions/bulk-update`, {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ids: [...selectedIds], patch })
    });
    const d = await r.json();
    if (r.ok) { toast(`${okMsg} (${d.updated})`, 'ok'); renderQuestionManager(); }
    else toast(d.error || 'Fehler.', 'err');
  } catch (e) { toast('Server nicht erreichbar.', 'err'); }
}

// ═══════════════════════════════════════════════════════════
//  EDITOR (rechte Spalte)
// ═══════════════════════════════════════════════════════════
function renderEditor() {
  const wrap = document.getElementById('qm-editor-body');
  const isNew = editorId === null;
  const q = isNew ? null : adminQuestions.find(x => x.id === editorId);
  const type = q ? q.type : 'mc';
  editorDifficulty = q ? q.difficulty : 2;

  document.getElementById('qm-editor-title').innerHTML = isNew
    ? '<i class="ti ti-plus"></i> Neue Frage'
    : '<i class="ti ti-edit"></i> Frage bearbeiten';
  document.getElementById('qm-editor-id').textContent = isNew ? '' : (q.id.slice(0, 14) + '…');

  wrap.innerHTML = `
    <div class="qe-field">
      <label>Fragetext <span class="req">*</span></label>
      <textarea id="qe-text" placeholder="z. B. Was ist die Broadcast-Adresse von:">${q ? esc(q.text) : ''}</textarea>
      <div class="qe-err" id="qe-text-err">Mindestens 10 Zeichen.</div>
    </div>

    <div class="qe-row">
      <div class="qe-field">
        <label>Fragetyp <span class="req">*</span></label>
        <select id="qe-type" onchange="onEditorTypeChange()">
          <option value="mc"${type==='mc'?' selected':''}>Multiple Choice</option>
          <option value="freetext"${type==='freetext'?' selected':''}>Freitext</option>
          <option value="order"${type==='order'?' selected':''}>Reihenfolge</option>
        </select>
      </div>
      <div class="qe-field">
        <label>Kategorie</label>
        <input type="text" id="qe-category" list="cat-datalist" placeholder="z. B. CIDR" value="${q ? esc(q.category) : ''}">
      </div>
    </div>

    <div class="qe-row">
      <div class="qe-field">
        <label>Schwierigkeit</label>
        <div class="star-input" id="qe-stars"></div>
      </div>
      <div class="qe-field">
        <label>IP / Netz (optional)</label>
        <input type="text" class="mono" id="qe-ip" placeholder="z. B. 192.168.5.64/26" value="${q ? esc(q.ip || '') : ''}">
      </div>
    </div>

    <div id="qe-dynamic"></div>

    <div class="qe-field">
      <label>Erklärung <span style="color:var(--text3);font-weight:400">(wird nach Antwort gezeigt)</span></label>
      <textarea id="qe-explain" placeholder="z. B. Blockgröße=64, Broadcast=.64+64–1=.127">${q ? esc(q.explain || '') : ''}</textarea>
    </div>

    <div class="qe-actions">
      <button class="qe-btn save" id="qe-save-btn" onclick="saveEditor()"><i class="ti ti-device-floppy"></i> Speichern</button>
      <button class="qe-btn" onclick="newQuestion()"><i class="ti ti-file-plus"></i> Neu</button>
      ${!isNew ? `<button class="qe-btn" onclick="duplicateQuestion('${q.id}')"><i class="ti ti-copy"></i> Duplizieren</button>` : ''}
      <span class="spacer"></span>
      ${!isNew ? `<button class="qe-btn del" onclick="deleteQuestion('${q.id}')"><i class="ti ti-trash"></i> Löschen</button>` : ''}
    </div>`;

  renderStars();
  renderDynamicFields(type, q);
}

function renderStars() {
  const box = document.getElementById('qe-stars');
  box.innerHTML = [1,2,3,4,5].map(i =>
    `<i class="ti ti-star-filled ${i <= editorDifficulty ? 'on' : ''}" data-v="${i}"
        onmouseover="hoverStars(${i})" onmouseout="renderStars()" onclick="setDifficulty(${i})"></i>`).join('');
}
function hoverStars(n) {
  document.querySelectorAll('#qe-stars i').forEach(el =>
    el.classList.toggle('hover-on', Number(el.dataset.v) <= n));
}
function setDifficulty(n) { editorDifficulty = n; renderStars(); }

function renderDynamicFields(type, q) {
  const dyn = document.getElementById('qe-dynamic');
  if (type === 'mc') {
    dyn.innerHTML = `
      <div class="qe-field">
        <label>Richtige Antwort <span class="req">*</span></label>
        <input type="text" class="mono" id="qe-correct" placeholder="z. B. 192.168.5.127" value="${q && q.type==='mc' ? esc(q.correct) : ''}">
        <div class="qe-err" id="qe-correct-err">Richtige Antwort erforderlich.</div>
      </div>
      <div class="qe-field">
        <label>Falsche Antworten <span class="req">*</span> <span style="color:var(--text3);font-weight:400">(eine pro Zeile, mind. 1)</span></label>
        <textarea class="mono" id="qe-wrong" placeholder="192.168.5.128&#10;192.168.5.63&#10;192.168.5.255">${q && q.type==='mc' ? esc((q.wrong||[]).join('\n')) : ''}</textarea>
        <div class="qe-err" id="qe-wrong-err">Mindestens eine falsche Antwort.</div>
      </div>`;
  } else if (type === 'freetext') {
    dyn.innerHTML = `
      <div class="qe-field">
        <label>Richtige Antwort <span class="req">*</span></label>
        <input type="text" class="mono" id="qe-correct" placeholder="z. B. 255.255.255.192" value="${q && q.type==='freetext' ? esc(q.correct) : ''}">
        <div class="qe-hint">Mehrere akzeptierte Antworten mit <code>|</code> trennen, z. B. <code>/24|255.255.255.0</code></div>
        <div class="qe-err" id="qe-correct-err">Richtige Antwort erforderlich.</div>
      </div>
      <div class="qe-field">
        <label class="qe-checkbox"><input type="checkbox" id="qe-casesens" ${q && q.caseSensitive ? 'checked' : ''}> Groß-/Kleinschreibung beachten</label>
      </div>`;
  } else {
    dyn.innerHTML = `
      <div class="qe-field">
        <label>Elemente in richtiger Reihenfolge <span class="req">*</span> <span style="color:var(--text3);font-weight:400">(eine pro Zeile, mind. 2)</span></label>
        <textarea class="mono" id="qe-order" style="min-height:110px" placeholder="Host-Bits berechnen&#10;Blockgröße ermitteln&#10;Nutzbare Hosts berechnen&#10;Subnetzmaske berechnen">${q && q.type==='order' ? esc((q.orderItems||[]).join('\n')) : ''}</textarea>
        <div class="qe-err" id="qe-order-err">Mindestens 2 Elemente.</div>
      </div>`;
  }
}

function onEditorTypeChange() {
  const type = document.getElementById('qe-type').value;
  // aktuelle Frage nur als Vorbelegung, wenn Typ unverändert
  const q = editorId ? adminQuestions.find(x => x.id === editorId) : null;
  renderDynamicFields(type, q && q.type === type ? q : null);
}

function selectQuestion(id) { editorId = id; renderEditor(); renderTable(); }
function newQuestion() { editorId = null; renderEditor(); renderTable(); }

function clearFieldErrors() {
  document.querySelectorAll('#qm-editor-body .invalid').forEach(e => e.classList.remove('invalid'));
  document.querySelectorAll('#qm-editor-body .qe-err').forEach(e => e.classList.remove('show'));
}
function markError(inputId, errId) {
  const inp = document.getElementById(inputId);
  const err = document.getElementById(errId);
  if (inp) inp.classList.add('invalid');
  if (err) err.classList.add('show');
}

function collectEditor() {
  const type = document.getElementById('qe-type').value;
  const q = {
    type,
    text:       document.getElementById('qe-text').value.trim(),
    category:   document.getElementById('qe-category').value.trim() || 'Allgemein',
    difficulty: editorDifficulty,
    ip:         document.getElementById('qe-ip').value.trim(),
    explain:    document.getElementById('qe-explain').value.trim()
  };
  if (type === 'mc') {
    q.correct = document.getElementById('qe-correct').value.trim();
    q.wrong = document.getElementById('qe-wrong').value.split('\n').map(s => s.trim()).filter(Boolean);
  } else if (type === 'freetext') {
    q.correct = document.getElementById('qe-correct').value.trim();
    q.caseSensitive = document.getElementById('qe-casesens').checked;
  } else {
    q.orderItems = document.getElementById('qe-order').value.split('\n').map(s => s.trim()).filter(Boolean);
  }
  return q;
}

function validateEditor(q) {
  clearFieldErrors();
  let ok = true;
  if (q.text.length < 10) { markError('qe-text', 'qe-text-err'); ok = false; }
  if (q.type === 'mc') {
    if (!q.correct) { markError('qe-correct', 'qe-correct-err'); ok = false; }
    if (q.wrong.length < 1) { markError('qe-wrong', 'qe-wrong-err'); ok = false; }
  } else if (q.type === 'freetext') {
    if (!q.correct) { markError('qe-correct', 'qe-correct-err'); ok = false; }
  } else {
    if (q.orderItems.length < 2) { markError('qe-order', 'qe-order-err'); ok = false; }
  }
  return ok;
}

async function saveEditor() {
  const q = collectEditor();
  if (!validateEditor(q)) { toast('Bitte markierte Felder korrigieren.', 'warn'); return; }
  const btn = document.getElementById('qe-save-btn');
  btn.disabled = true;
  const isNew = editorId === null;
  try {
    const url = isNew ? `${API_BASE}/questions` : `${API_BASE}/questions/${editorId}`;
    const resp = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(q)
    });
    const data = await resp.json();
    if (!resp.ok) { toast(data.error || 'Speichern fehlgeschlagen.', 'err'); btn.disabled = false; return; }
    toast(isNew ? 'Frage erstellt.' : 'Änderungen gespeichert.', 'ok');
    editorId = data.id;
    await renderQuestionManager();
    renderEditor();
  } catch (e) {
    toast('Server nicht erreichbar.', 'err');
    btn.disabled = false;
  }
}

async function duplicateQuestion(id) {
  const q = adminQuestions.find(x => x.id === id);
  if (!q) return;
  const copy = JSON.parse(JSON.stringify(q));
  delete copy.id; delete copy.stats; delete copy.createdAt; delete copy.updatedAt;
  copy.text = q.text + ' (Kopie)';
  try {
    const resp = await fetch(`${API_BASE}/questions`, {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(copy)
    });
    const data = await resp.json();
    if (resp.ok) { toast('Frage dupliziert.', 'ok'); editorId = data.id; await renderQuestionManager(); renderEditor(); }
    else toast(data.error || 'Fehler.', 'err');
  } catch (e) { toast('Server nicht erreichbar.', 'err'); }
}

// Löschen mit 5-Sekunden-Undo
async function deleteQuestion(id) {
  const q = adminQuestions.find(x => x.id === id);
  if (!q) return;
  try {
    const resp = await fetch(`${API_BASE}/questions/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!resp.ok) { toast('Löschen fehlgeschlagen.', 'err'); return; }
    if (editorId === id) newQuestion();
    selectedIds.delete(id);
    await renderQuestionManager();
    // Undo anbieten
    const snapshot = JSON.parse(JSON.stringify(q));
    delete snapshot.stats;
    toast('Frage gelöscht.', 'ok', { label: 'Rückgängig', fn: () => restoreQuestion(snapshot) }, 5000);
  } catch (e) { toast('Server nicht erreichbar.', 'err'); }
}

async function restoreQuestion(snapshot) {
  const payload = Object.assign({}, snapshot);
  delete payload.id; delete payload.createdAt; delete payload.updatedAt;
  try {
    const resp = await fetch(`${API_BASE}/questions`, {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    if (resp.ok) { toast('Wiederhergestellt.', 'ok'); renderQuestionManager(); }
    else toast('Wiederherstellen fehlgeschlagen.', 'err');
  } catch (e) { toast('Server nicht erreichbar.', 'err'); }
}

// ═══════════════════════════════════════════════════════════
//  EXPORT / IMPORT
// ═══════════════════════════════════════════════════════════
async function exportQuestions() {
  try {
    const resp = await fetch(`${API_BASE}/questions/export`, { headers: authHeaders() });
    downloadBlob(await resp.blob(), 'subnetting-questions.json');
  } catch (e) { toast('Export fehlgeschlagen.', 'err'); }
}

let importParsed = [];
function openImport() {
  importParsed = [];
  document.getElementById('import-preview').innerHTML = '';
  document.getElementById('import-confirm-btn').disabled = true;
  document.getElementById('import-file').value = '';
  document.getElementById('gm-import').classList.add('open');
}
function closeImport() { document.getElementById('gm-import').classList.remove('open'); }

function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      let questions;
      if (file.name.toLowerCase().endsWith('.csv')) questions = parseCSV(reader.result);
      else {
        const json = JSON.parse(reader.result);
        questions = Array.isArray(json) ? json : (json.questions || []);
      }
      importParsed = questions;
      renderImportPreview(questions);
    } catch (e) {
      toast('Datei konnte nicht gelesen werden: ' + e.message, 'err');
    }
  };
  reader.readAsText(file);
}

// einfacher CSV-Parser (Header-Zeile + Spalten aus dem Anleitungs-Schema)
function parseCSV(text) {
  const rows = csvToRows(text);
  if (rows.length < 2) return [];
  const header = rows[0].map(h => h.trim().toLowerCase());
  const idx = name => header.indexOf(name);
  return rows.slice(1).filter(r => r.length && r.some(c => c.trim())).map(r => {
    const get = n => { const i = idx(n); return i >= 0 ? (r[i] || '').trim() : ''; };
    const type = get('type') || 'mc';
    const q = {
      type,
      text: get('text'),
      category: get('category') || 'Allgemein',
      difficulty: Number(get('difficulty')) || 2,
      ip: get('ip'),
      explain: get('explain')
    };
    if (type === 'mc') {
      q.correct = get('correct');
      q.wrong = ['wrong1','wrong2','wrong3','wrong4'].map(get).filter(Boolean);
    } else if (type === 'freetext') {
      q.correct = get('correct');
    } else if (type === 'order') {
      // Reihenfolge: 'items' Spalte mit | getrennt
      q.orderItems = get('items').split('|').map(s => s.trim()).filter(Boolean);
    }
    return q;
  });
}
// CSV → Zeilen/Spalten (mit Quote-Unterstützung)
function csvToRows(text) {
  const rows = []; let row = []; let field = ''; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inQuotes) {
      if (c === '"' && n === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function renderImportPreview(questions) {
  const box = document.getElementById('import-preview');
  if (!questions.length) { box.innerHTML = '<div class="pv-item bad">Keine gültigen Zeilen gefunden.</div>'; document.getElementById('import-confirm-btn').disabled = true; return; }
  let validCount = 0;
  box.innerHTML = questions.map((q, i) => {
    const err = clientValidate(q);
    if (!err) validCount++;
    return `<div class="pv-item ${err ? 'bad' : ''}">
      <span class="type-badge ${TYPE_CLASS[q.type] || 'mc'}">${TYPE_LABEL[q.type] || '?'}</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(q.text || '(leer)')}</span>
      ${err ? `<span title="${esc(err)}">⚠</span>` : '✓'}
    </div>`;
  }).join('');
  document.getElementById('import-summary').textContent = `${validCount} gültig, ${questions.length - validCount} fehlerhaft`;
  document.getElementById('import-confirm-btn').disabled = validCount === 0;
}

// clientseitige Spiegelung der Server-Validierung (für Preview)
function clientValidate(q) {
  if (!q || typeof q.text !== 'string' || q.text.trim().length < 10) return 'Fragetext zu kurz';
  if (!['mc','freetext','order'].includes(q.type)) return 'Ungültiger Typ';
  if (q.type === 'mc') {
    if (!q.correct) return 'Richtige Antwort fehlt';
    if (!(q.wrong || []).filter(Boolean).length) return 'Falsche Antwort fehlt';
  } else if (q.type === 'freetext') {
    if (!q.correct) return 'Richtige Antwort fehlt';
  } else if (q.type === 'order') {
    if ((q.orderItems || []).filter(Boolean).length < 2) return 'Mind. 2 Elemente';
  }
  return null;
}

async function confirmImport() {
  const mode = document.querySelector('input[name="import-mode"]:checked').value;
  try {
    const resp = await fetch(`${API_BASE}/questions/import`, {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ mode, questions: importParsed })
    });
    const d = await resp.json();
    if (resp.ok) {
      toast(`Import: ${d.added} neu, ${d.updated} aktualisiert, ${d.skipped} übersprungen.`, 'ok');
      closeImport();
      renderQuestionManager();
    } else toast(d.error || 'Import fehlgeschlagen.', 'err');
  } catch (e) { toast('Server nicht erreichbar.', 'err'); }
}

// ═══════════════════════════════════════════════════════════
//  KATEGORIEN-VERWALTUNG
// ═══════════════════════════════════════════════════════════
function openCategories() { renderCategoryList(); document.getElementById('gm-cats').classList.add('open'); }
function closeCategories() { document.getElementById('gm-cats').classList.remove('open'); }

function renderCategoryList() {
  const counts = {};
  adminQuestions.forEach(q => { counts[q.category] = (counts[q.category] || 0) + 1; });
  const cats = allCategories();
  document.getElementById('cat-list').innerHTML = cats.map(c => `
    <div class="cat-item">
      <span class="cat-name">${esc(c)}</span>
      <span class="cat-count">${counts[c] || 0} Fragen</span>
      <button class="row-act" onclick="renameCategory('${esc(c).replace(/'/g, "\\'")}')"><i class="ti ti-edit"></i></button>
      <button class="row-act del" onclick="deleteCategory('${esc(c).replace(/'/g, "\\'")}', ${counts[c] || 0})"><i class="ti ti-trash"></i></button>
    </div>`).join('') || '<div class="empty-state">Noch keine Kategorien.</div>';
}

function addCategory() {
  const inp = document.getElementById('cat-new');
  const name = inp.value.trim();
  if (!name) return;
  const custom = JSON.parse(localStorage.getItem('sn_categories') || '[]');
  if (!custom.includes(name) && !allCategories().includes(name)) custom.push(name);
  localStorage.setItem('sn_categories', JSON.stringify(custom));
  inp.value = '';
  refreshCategoryFilter(); renderCategoryList(); renderStatBar();
  toast(`Kategorie „${name}" hinzugefügt.`, 'ok');
}

async function renameCategory(oldName) {
  const newName = prompt(`Kategorie „${oldName}" umbenennen in:`, oldName);
  if (!newName || newName.trim() === oldName) return;
  const affected = adminQuestions.filter(q => q.category === oldName);
  if (affected.length) {
    await fetch(`${API_BASE}/questions/bulk-update`, {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ids: affected.map(q => q.id), patch: { category: newName.trim() } })
    });
  }
  // Custom-Liste anpassen
  let custom = JSON.parse(localStorage.getItem('sn_categories') || '[]');
  custom = custom.map(c => c === oldName ? newName.trim() : c);
  localStorage.setItem('sn_categories', JSON.stringify(custom));
  toast(`Umbenannt in „${newName.trim()}".`, 'ok');
  await renderQuestionManager(); renderCategoryList();
}

function deleteCategory(name, count) {
  if (count > 0) { toast(`„${name}" hat noch ${count} Fragen – erst umordnen.`, 'warn'); return; }
  let custom = JSON.parse(localStorage.getItem('sn_categories') || '[]');
  custom = custom.filter(c => c !== name);
  localStorage.setItem('sn_categories', JSON.stringify(custom));
  refreshCategoryFilter(); renderCategoryList(); renderStatBar();
  toast(`Kategorie „${name}" gelöscht.`, 'ok');
}

// ═══════════════════════════════════════════════════════════
//  TOASTS  +  HILFSFUNKTIONEN
// ═══════════════════════════════════════════════════════════
function toast(msg, type = 'ok', action = null, ttl = 3200) {
  const stack = document.getElementById('toast-stack');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'ok' ? 'circle-check' : type === 'err' ? 'alert-circle' : type === 'warn' ? 'alert-triangle' : 'info-circle';
  el.innerHTML = `<i class="ti ti-${icon}"></i><span>${esc(msg)}</span>`;
  if (action) {
    const b = document.createElement('button');
    b.className = 'toast-action';
    b.textContent = action.label;
    b.onclick = () => { action.fn(); dismiss(); };
    el.appendChild(b);
  }
  stack.appendChild(el);
  let removed = false;
  const dismiss = () => {
    if (removed) return; removed = true;
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 200);
  };
  setTimeout(dismiss, ttl);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Init: Listener verdrahten, Token-Restore ──────────────
document.addEventListener('DOMContentLoaded', () => {
  // Suche/Filter Live
  ['qm-filter-type','qm-filter-cat','qm-filter-diff'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', onFilterChange);
  });
  const search = document.getElementById('qm-search');
  if (search) {
    let t;
    search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(onFilterChange, 200); });
  }
  const pageSize = document.getElementById('qm-page-size');
  if (pageSize) pageSize.addEventListener('change', changePageSize);

  // Import-Datei
  const fileInp = document.getElementById('import-file');
  if (fileInp) fileInp.addEventListener('change', e => handleImportFile(e.target.files[0]));
  const drop = document.getElementById('import-drop');
  if (drop) {
    drop.addEventListener('click', () => fileInp.click());
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('dragover'); handleImportFile(e.dataTransfer.files[0]); });
  }
  const catNew = document.getElementById('cat-new');
  if (catNew) catNew.addEventListener('keydown', e => { if (e.key === 'Enter') addCategory(); });

  // Modals per Klick auf Overlay schließen
  document.querySelectorAll('.gm-overlay').forEach(ov =>
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); }));
});
