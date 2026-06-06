// TruthLens Dashboard — loaded as an external script via webview.asWebviewUri

(function () {
  'use strict';

  const vscode = acquireVsCodeApi();

  // Read initial data from the JSON data tag embedded in the HTML
  const dataEl = document.getElementById('initial-report');
  let report = dataEl ? JSON.parse(dataEl.textContent || 'null') : null;

  const F = { sevs: new Set(['critical','high','medium','low']), cats: new Set(['CAT-A','CAT-B','CAT-C','CAT-D']), q: '', cell: null };
  const S = { col: 'severity', dir: 'asc' };

  const SEV_ORD  = { critical:0, high:1, medium:2, low:3 };
  const SEV_COL  = { critical:'#f44747', high:'#ff9900', medium:'#3794ff', low:'#89d185' };
  const CAT_NAME = { 'CAT-A':'Fn Name', 'CAT-B':'Docstring', 'CAT-C':'Test Name', 'CAT-D':'README' };
  const CATS = ['CAT-A','CAT-B','CAT-C','CAT-D'];

  // ── Message bus ──────────────────────────────────────────────────────────────

  window.addEventListener('message', function(e) {
    if (e.data.type === 'update') { report = e.data.data; renderAll(); }
  });

  function send(type, findingId) { vscode.postMessage({ type: type, findingId: findingId }); }

  // ── Event delegation (replaces all inline onclick/oninput) ────────────────────
  // CSP with script-src 'nonce-...' blocks inline event handlers, so we use
  // a single delegated listener on document.body with data-action attributes.

  document.body.addEventListener('click', function(e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var action = el.getAttribute('data-action');
    switch (action) {
      case 'runAudit':        send('runAudit'); break;
      case 'fixAllOpen':      send('fixAllOpen'); break;
      case 'toggleSev':       toggleSev(el.getAttribute('data-sev')); break;
      case 'toggleCat':       toggleCat(el.getAttribute('data-cat')); break;
      case 'setSort':         setSort(el.getAttribute('data-col')); break;
      case 'viewFinding':     send('viewFinding', el.getAttribute('data-id')); break;
      case 'showDetail':      send('showDetail',  el.getAttribute('data-id')); break;
      case 'fixFinding':      send('fixFinding',  el.getAttribute('data-id')); break;
      case 'clearCellFilter': clearCellFilter(); break;
    }
  });

  document.body.addEventListener('input', function(e) {
    if (e.target.id === 'search-box') { onSearch(e.target.value); }
  });

  // ── Top-level render ─────────────────────────────────────────────────────────

  function renderAll() {
    renderHeader();
    var main = document.getElementById('main');
    if (!report || !report.findings || report.findings.length === 0) {
      main.innerHTML = '<div class="empty"><p>No findings loaded. Run an audit to begin.</p><button class="btn" data-action="runAudit">Run Audit</button></div>';
      return;
    }
    main.innerHTML = heatSection() + categorySection() + offendersSection() + findingsSection();
    bindHeatCells();
    syncChips();
    renderTable();
  }

  // ── Header ───────────────────────────────────────────────────────────────────

  function renderHeader() {
    var stats = document.getElementById('hdr-stats');
    var meta  = document.getElementById('hdr-meta');
    if (!report) { stats.innerHTML = ''; meta.innerHTML = ''; return; }
    var s = report.summary;
    stats.innerHTML =
      pill('total',    report.summary.total + ' findings') +
      (s.critical ? pill('critical', s.critical + ' critical') : '') +
      (s.high     ? pill('high',     s.high     + ' high')     : '') +
      (s.medium   ? pill('medium',   s.medium   + ' medium')   : '') +
      (s.low      ? pill('low',      s.low      + ' low')      : '');
    var repoName = (report.repository.root || '').replace(/\\/g,'/').split('/').pop() || report.repository.root;
    var ts = new Date(report.generatedAt).toLocaleString();
    meta.innerHTML = x(repoName) + '<br>Last audit: ' + x(ts);
  }

  function pill(cls, txt) { return '<span class="stat-pill pill-' + cls + '">' + x(txt) + '</span>'; }

  // ── Heat map ─────────────────────────────────────────────────────────────────

  function heatSection() {
    var open = report.findings.filter(function(f){ return f.status === 'open'; });
    var files = topFiles(open, 12);
    var thead = '<th class="col-file">File</th>' + CATS.map(function(c){ return '<th>' + x(CAT_NAME[c]) + '</th>'; }).join('');
    var tbody = files.map(function(file) {
      var tds = '<td class="td-file" title="' + x(file) + '">' + x(shortPath(file)) + '</td>';
      tds += CATS.map(function(cat) {
        var count = open.filter(function(f){ return f.file === file && f.category === cat; }).length;
        if (count === 0) return '<td class="heat-cell" data-file="' + x(file) + '" data-cat="' + cat + '" style="color:var(--vscode-widget-border)">&#183;</td>';
        var alpha = Math.min(0.3 + count * 0.22, 0.92).toFixed(2);
        return '<td class="heat-cell" data-file="' + x(file) + '" data-cat="' + cat + '" style="background:rgba(255,140,0,' + alpha + ');color:#fff">' + count + '</td>';
      }).join('');
      return '<tr>' + tds + '</tr>';
    }).join('');
    var note = files.length < topFiles(open, 9999).length
      ? '<p style="font-size:11px;color:var(--vscode-descriptionForeground);margin-top:6px">Showing top 12 files of ' + topFiles(open,9999).length + ' total</p>'
      : '';
    return '<div class="section"><div class="sec-title">Severity Heat Map <span style="font-weight:400;text-transform:none">(click cell to filter findings)</span></div><div class="heatmap-scroll"><table id="heatmap-table"><thead><tr>' + thead + '</tr></thead><tbody>' + tbody + '</tbody></table></div>' + note + '</div>';
  }

  function topFiles(findings, n) {
    var counts = {};
    findings.forEach(function(f){ counts[f.file] = (counts[f.file] || 0) + 1; });
    return Object.keys(counts).sort(function(a,b){ return counts[b] - counts[a]; }).slice(0, n);
  }

  function bindHeatCells() {
    document.querySelectorAll('.heat-cell').forEach(function(cell) {
      cell.addEventListener('click', function() {
        var file = cell.getAttribute('data-file');
        var cat  = cell.getAttribute('data-cat');
        if (F.cell && F.cell.file === file && F.cell.cat === cat) {
          F.cell = null;
          cell.classList.remove('selected');
        } else {
          document.querySelectorAll('.heat-cell.selected').forEach(function(c){ c.classList.remove('selected'); });
          F.cell = { file: file, cat: cat };
          cell.classList.add('selected');
        }
        updateCellNote();
        renderTable();
      });
    });
  }

  // ── Category overview ────────────────────────────────────────────────────────

  function categorySection() {
    var open = report.findings.filter(function(f){ return f.status === 'open'; });
    var total = open.length || 1;
    var cards = CATS.map(function(cat) {
      var count = open.filter(function(f){ return f.category === cat; }).length;
      var pct = (count / total * 100).toFixed(1);
      return '<div class="cat-card">' +
        '<div class="cat-card-name">' + x(CAT_NAME[cat]) + '</div>' +
        '<div class="cat-card-code">' + x(cat) + '</div>' +
        '<div class="cat-card-count">' + count + '</div>' +
        '<div class="cat-bar-track"><div class="cat-bar-fill" style="width:' + pct + '%"></div></div>' +
      '</div>';
    }).join('');
    return '<div class="section"><div class="sec-title">By Category</div><div class="cat-grid">' + cards + '</div></div>';
  }

  // ── Top offenders ────────────────────────────────────────────────────────────

  function offendersSection() {
    var open = report.findings.filter(function(f){ return f.status === 'open'; });
    if (!open.length) return '';
    var counts = {}, sevs = {};
    open.forEach(function(f) {
      counts[f.file] = (counts[f.file] || 0) + 1;
      if (!sevs[f.file]) sevs[f.file] = { critical:0, high:0, medium:0, low:0 };
      sevs[f.file][f.severity]++;
    });
    var top5 = Object.keys(counts).sort(function(a,b){ return counts[b]-counts[a]; }).slice(0,5);
    var rows = top5.map(function(file, i) {
      var total = counts[file];
      var s = sevs[file];
      var barSegs = ['critical','high','medium','low'].map(function(sev) {
        if (!s[sev]) return '';
        return '<div class="bar-' + sev + '" style="width:' + (s[sev]/total*100).toFixed(1) + '%" title="' + s[sev] + ' ' + sev + '"></div>';
      }).join('');
      return '<div class="offender-row"><span class="off-rank">' + (i+1) + '</span><span class="off-file" title="' + x(file) + '">' + x(shortPath(file)) + '</span><span class="off-count">' + total + '</span><div class="sev-bar">' + barSegs + '</div></div>';
    }).join('');
    return '<div class="section"><div class="sec-title">Top Offenders</div><div class="offender-list">' + rows + '</div></div>';
  }

  // ── Findings section skeleton ─────────────────────────────────────────────────

  function findingsSection() {
    var sevChips = ['critical','high','medium','low'].map(function(s) {
      return '<span class="chip" id="chip-sev-' + s + '" style="background:' + SEV_COL[s] + ';color:' + (s === 'low' ? '#1a1a1a' : '#fff') + '" data-action="toggleSev" data-sev="' + s + '">' + s + '</span>';
    }).join('');
    var catChips = CATS.map(function(c) {
      return '<span class="chip" id="chip-cat-' + c + '" style="background:var(--vscode-badge-background);color:var(--vscode-badge-foreground)" data-action="toggleCat" data-cat="' + c + '">' + x(CAT_NAME[c]) + '</span>';
    }).join('');
    return '<div class="section" id="findings-section">' +
      '<div class="sec-title">All Findings</div>' +
      '<div class="filters">' +
        '<div class="fg"><div class="fg-label">Severity</div><div class="chips">' + sevChips + '</div></div>' +
        '<div class="fg"><div class="fg-label">Category</div><div class="chips">' + catChips + '</div></div>' +
        '<div class="fg"><div class="fg-label">Search</div><input class="search-box" id="search-box" placeholder="Search claims, files..."></div>' +
        '<div style="flex:1"></div><div id="cell-note"></div>' +
      '</div>' +
      '<div id="table-wrap"></div>' +
    '</div>';
  }

  // ── Findings table ────────────────────────────────────────────────────────────

  function renderTable() {
    var wrap = document.getElementById('table-wrap');
    if (!wrap || !report) return;

    var open = report.findings.filter(function(f){ return f.status === 'open'; });

    var items = open.filter(function(f) {
      if (!F.sevs.has(f.severity)) return false;
      if (!F.cats.has(f.category)) return false;
      if (F.q) {
        var q = F.q.toLowerCase();
        if (f.claim.text.toLowerCase().indexOf(q) === -1 &&
            f.file.toLowerCase().indexOf(q) === -1 &&
            f.id.toLowerCase().indexOf(q) === -1) return false;
      }
      if (F.cell && (f.file !== F.cell.file || f.category !== F.cell.cat)) return false;
      return true;
    });

    items.sort(function(a, b) {
      var cmp = 0;
      if      (S.col === 'severity') cmp = SEV_ORD[a.severity] - SEV_ORD[b.severity];
      else if (S.col === 'category') cmp = a.category < b.category ? -1 : a.category > b.category ? 1 : 0;
      else if (S.col === 'file')     cmp = a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
      else if (S.col === 'id')       cmp = a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      return S.dir === 'desc' ? -cmp : cmp;
    });

    var cols = ['id','severity','category','file','claim','actions'];
    var hdrs  = ['ID','Severity','Category','File','Claim','Actions'];
    var thHtml = cols.map(function(col, i) {
      var sortable = col !== 'claim' && col !== 'actions';
      var arrow = S.col === col ? (S.dir === 'asc' ? ' &#9650;' : ' &#9660;') : '';
      return '<th' + (sortable ? ' class="sortable" data-action="setSort" data-col="' + col + '"' : '') + '>' + hdrs[i] + arrow + '</th>';
    }).join('');

    var rowHtml = items.map(function(f) {
      var sev     = '<span class="sev sev-' + f.severity + '">' + f.severity + '</span>';
      var cat     = '<span class="cat">' + x(CAT_NAME[f.category] || f.category) + '</span>';
      var fileLnk = '<span class="file-link" data-action="viewFinding" data-id="' + x(f.id) + '">' + x(shortPath(f.file)) + ':' + f.line + '</span>';
      var claim   = '<div class="claim-cell" title="' + x(f.claim.text) + '">' + x(trunc(f.claim.text, 60)) + '</div>';
      var acts    = '<div class="act-cell"><button class="act act-view" data-action="showDetail" data-id="' + x(f.id) + '">View</button><button class="act act-fix" data-action="fixFinding" data-id="' + x(f.id) + '">Fix with Bob</button></div>';
      return '<tr><td>' + x(f.id) + '</td><td>' + sev + '</td><td>' + cat + '</td><td>' + fileLnk + '</td><td>' + claim + '</td><td>' + acts + '</td></tr>';
    }).join('');

    if (!rowHtml) rowHtml = '<tr><td colspan="6" class="no-results">No findings match the current filters.</td></tr>';

    wrap.innerHTML =
      '<div class="count-note">' + items.length + ' of ' + open.length + ' open findings</div>' +
      '<div class="findings-scroll"><table id="findings-table"><thead><tr>' + thHtml + '</tr></thead><tbody>' + rowHtml + '</tbody></table></div>';
  }

  // ── Filter controls ───────────────────────────────────────────────────────────

  function syncChips() {
    ['critical','high','medium','low'].forEach(function(s) {
      var el = document.getElementById('chip-sev-' + s);
      if (el) el.classList.toggle('off', !F.sevs.has(s));
    });
    CATS.forEach(function(c) {
      var el = document.getElementById('chip-cat-' + c);
      if (el) el.classList.toggle('off', !F.cats.has(c));
    });
  }

  function toggleSev(s) {
    if (F.sevs.has(s)) { F.sevs.delete(s); } else { F.sevs.add(s); }
    syncChips(); renderTable();
  }

  function toggleCat(c) {
    if (F.cats.has(c)) { F.cats.delete(c); } else { F.cats.add(c); }
    syncChips(); renderTable();
  }

  function onSearch(v) { F.q = v; renderTable(); }

  function updateCellNote() {
    var el = document.getElementById('cell-note');
    if (!el) return;
    if (F.cell) {
      el.innerHTML = '<span class="cell-filter-note" data-action="clearCellFilter">&#10005; Clear: ' + x(CAT_NAME[F.cell.cat]) + ' in ' + x(shortPath(F.cell.file)) + '</span>';
    } else {
      el.innerHTML = '';
    }
  }

  function clearCellFilter() {
    F.cell = null;
    document.querySelectorAll('.heat-cell.selected').forEach(function(c){ c.classList.remove('selected'); });
    updateCellNote();
    renderTable();
  }

  function setSort(col) {
    if (S.col === col) { S.dir = S.dir === 'asc' ? 'desc' : 'asc'; } else { S.col = col; S.dir = 'asc'; }
    renderTable();
  }

  // ── Utilities ─────────────────────────────────────────────────────────────────

  function x(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  function trunc(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }
  function shortPath(p) {
    var parts = String(p).replace(/\\/g,'/').split('/');
    return parts.length > 3 ? '…/' + parts.slice(-2).join('/') : p;
  }

  // ── Boot ──────────────────────────────────────────────────────────────────────

  renderAll();

}());
