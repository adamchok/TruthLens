// TruthLens Finding Detail Panel — external script loaded via webview.asWebviewUri

(function () {
  'use strict';

  const vscode = acquireVsCodeApi();

  // Read initial finding data from the embedded JSON tag
  const dataEl = document.getElementById('finding-data');
  const finding = dataEl ? JSON.parse(dataEl.textContent || 'null') : null;

  // ── Event delegation ──────────────────────────────────────────────────────────

  document.body.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var action = el.getAttribute('data-action');
    var id = finding ? finding.id : '';
    switch (action) {
      case 'openFile':       vscode.postMessage({ type: 'openFile',      findingId: id }); break;
      case 'fixArtifact':    vscode.postMessage({ type: 'fixArtifact',   findingId: id, strategy: 'rename_artifact' }); break;
      case 'fixCode':        vscode.postMessage({ type: 'fixCode',       findingId: id, strategy: 'fix_implementation' }); break;
      case 'markResolved':   vscode.postMessage({ type: 'markResolved',  findingId: id }); break;
      case 'dismiss':        vscode.postMessage({ type: 'dismiss',       findingId: id }); break;
    }
  });

}());
