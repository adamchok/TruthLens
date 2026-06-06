import * as vscode from 'vscode';
import { FindingsReport } from './types';

export class DashboardPanel {
	private static currentPanel: DashboardPanel | undefined;

	private readonly panel: vscode.WebviewPanel;
	private readonly extensionUri: vscode.Uri;
	private disposables: vscode.Disposable[] = [];
	private currentReport: FindingsReport | null = null;

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, initialReport: FindingsReport | null) {
		this.panel = panel;
		this.extensionUri = extensionUri;
		this.currentReport = initialReport;
		this.panel.webview.html = this.getShellHtml(initialReport, this.getNonce());

		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

		this.panel.webview.onDidReceiveMessage(
			async (msg: { type: string; findingId?: string }) => {
				switch (msg.type) {
					case 'runAudit':
						await vscode.commands.executeCommand('truthlens.audit');
						break;
					case 'viewFinding': {
						if (!msg.findingId || !this.currentReport) { break; }
						const f = this.currentReport.findings.find(x => x.id === msg.findingId);
						if (f) { await vscode.commands.executeCommand('truthlens.openFinding', f); }
						break;
					}
					case 'showDetail': {
						if (!msg.findingId || !this.currentReport) { break; }
						const f = this.currentReport.findings.find(x => x.id === msg.findingId);
						if (f) { await vscode.commands.executeCommand('truthlens.showFindingDetail', f); }
						break;
					}
					case 'fixFinding':
						await vscode.commands.executeCommand('truthlens.fix', msg.findingId);
						break;
					case 'fixAllOpen':
						await vscode.commands.executeCommand('truthlens.fixAll');
						break;
				}
			},
			null,
			this.disposables
		);
	}

	static show(report: FindingsReport | null, extensionUri: vscode.Uri): void {
		const column = vscode.ViewColumn.Beside;
		if (DashboardPanel.currentPanel) {
			DashboardPanel.currentPanel.panel.reveal(column);
			DashboardPanel.currentPanel.setReport(report);
			return;
		}
		const panel = vscode.window.createWebviewPanel(
			'truthlensDashboard',
			'TruthLens Dashboard',
			column,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
			}
		);
		DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri, report);
	}

	static update(report: FindingsReport | null): void {
		DashboardPanel.currentPanel?.setReport(report);
	}

	private setReport(report: FindingsReport | null): void {
		this.currentReport = report;
		this.panel.webview.postMessage({ type: 'update', data: report });
	}

	private getNonce(): string {
		let text = '';
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) {
			text += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return text;
	}

	private getShellHtml(initialReport: FindingsReport | null, nonce: string): string {
		const webview = this.panel.webview;
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.extensionUri, 'media', 'dashboard.js')
		);
		const csp = webview.cspSource;
		const reportJson = JSON.stringify(initialReport).replace(/<\//g, '<\\/');
		return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}' ${csp};">
<title>TruthLens Dashboard</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
  overflow-x: hidden;
}

/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
#header {
  padding: 12px 20px;
  background: var(--vscode-sideBar-background, var(--vscode-editor-background));
  border-bottom: 1px solid var(--vscode-widget-border);
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  position: sticky;
  top: 0;
  z-index: 10;
}
.header-title { font-size: 15px; font-weight: 700; flex-shrink: 0; }
.header-stats { display: flex; gap: 6px; flex-wrap: wrap; flex: 1; min-width: 0; }
.stat-pill {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px; border-radius: 10px;
  font-size: 11px; font-weight: 700; white-space: nowrap;
}
.pill-total   { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
.pill-critical{ background: rgba(244,71,71,0.15);  color: #f44747; }
.pill-high    { background: rgba(255,153,0,0.15);  color: #ff9900; }
.pill-medium  { background: rgba(55,148,255,0.15); color: #3794ff; }
.pill-low     { background: rgba(137,209,133,0.15);color: #89d185; }
.header-meta  { font-size: 11px; color: var(--vscode-descriptionForeground); flex-shrink: 0; line-height: 1.6; }
.btn {
  padding: 5px 12px; border: none; border-radius: 3px; cursor: pointer;
  font-size: 12px; font-family: var(--vscode-font-family);
  background: var(--vscode-button-background); color: var(--vscode-button-foreground);
  flex-shrink: 0;
}
.btn:hover { background: var(--vscode-button-hoverBackground); }
.btn-sec {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}
.btn-sec:hover { background: var(--vscode-button-secondaryHoverBackground); }

/* â”€â”€ Sections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.section {
  padding: 14px 20px;
  border-bottom: 1px solid var(--vscode-widget-border);
}
.sec-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.6px; color: var(--vscode-descriptionForeground);
  margin-bottom: 10px;
}

/* â”€â”€ Heat map â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.heatmap-scroll { overflow-x: auto; }
#heatmap-table { border-collapse: collapse; font-size: 12px; min-width: 400px; }
#heatmap-table th {
  padding: 5px 12px; text-align: center; font-size: 11px;
  color: var(--vscode-descriptionForeground); white-space: nowrap;
}
#heatmap-table th.col-file { text-align: left; min-width: 160px; }
#heatmap-table td { padding: 4px 12px; border: 1px solid var(--vscode-widget-border); text-align: center; }
#heatmap-table td.td-file {
  text-align: left; font-family: var(--vscode-editor-font-family); font-size: 11px;
  white-space: nowrap; max-width: 220px; overflow: hidden; text-overflow: ellipsis;
}
.heat-cell { cursor: pointer; font-weight: 700; font-size: 12px; transition: filter 0.1s; border-radius: 2px; }
.heat-cell:hover { filter: brightness(1.25); }
.heat-cell.selected { outline: 2px solid var(--vscode-focusBorder); outline-offset: -2px; }

/* â”€â”€ Category overview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.cat-grid { display: flex; gap: 12px; flex-wrap: wrap; }
.cat-card {
  flex: 1; min-width: 110px;
  padding: 10px 14px;
  background: var(--vscode-textBlockQuote-background);
  border-radius: 4px;
  display: flex; flex-direction: column; gap: 4px;
}
.cat-card-name { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cat-card-code { font-size: 10px; color: var(--vscode-descriptionForeground); }
.cat-card-count { font-size: 22px; font-weight: 700; line-height: 1.2; }
.cat-bar-track { height: 4px; background: var(--vscode-widget-border); border-radius: 2px; margin-top: 2px; }
.cat-bar-fill  { height: 4px; background: var(--vscode-progressBar-background, #3794ff); border-radius: 2px; min-width: 2px; }

/* â”€â”€ Top offenders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.offender-list { display: flex; flex-direction: column; gap: 6px; }
.offender-row {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 10px;
  background: var(--vscode-textBlockQuote-background);
  border-radius: 4px;
}
.off-rank { font-weight: 700; font-size: 13px; color: var(--vscode-descriptionForeground); width: 18px; text-align: right; flex-shrink: 0; }
.off-file { font-family: var(--vscode-editor-font-family); font-size: 11px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.off-count { font-weight: 700; font-size: 12px; flex-shrink: 0; }
.sev-bar { display: flex; height: 7px; border-radius: 3px; overflow: hidden; width: 80px; flex-shrink: 0; }
.bar-critical { background: #f44747; }
.bar-high     { background: #ff9900; }
.bar-medium   { background: #3794ff; }
.bar-low      { background: #89d185; }

/* â”€â”€ Filters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.filters { display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 10px; }
.fg { display: flex; flex-direction: column; gap: 4px; }
.fg-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; color: var(--vscode-descriptionForeground); }
.chips { display: flex; gap: 4px; flex-wrap: wrap; }
.chip {
  padding: 2px 8px; border-radius: 9px; font-size: 11px; font-weight: 700;
  cursor: pointer; border: 1px solid transparent;
  transition: opacity 0.15s;
}
.chip.off { opacity: 0.28; }
.chip:hover { opacity: 1 !important; }
.search-box {
  padding: 4px 8px; width: 180px;
  background: var(--vscode-input-background); color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
  border-radius: 3px; font-family: var(--vscode-font-family); font-size: 12px;
}
.search-box::placeholder { color: var(--vscode-input-placeholderForeground); }
.search-box:focus { outline: 1px solid var(--vscode-focusBorder); }
.cell-filter-note { font-size: 11px; color: var(--vscode-textLink-foreground); cursor: pointer; }
.cell-filter-note:hover { text-decoration: underline; }

/* â”€â”€ Findings table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.count-note { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; }
.findings-scroll { overflow-x: auto; }
#findings-table { width: 100%; border-collapse: collapse; font-size: 12px; }
#findings-table th {
  padding: 6px 10px; text-align: left; font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.4px;
  color: var(--vscode-descriptionForeground);
  border-bottom: 1px solid var(--vscode-widget-border);
  white-space: nowrap; user-select: none;
}
#findings-table th.sortable { cursor: pointer; }
#findings-table th.sortable:hover { color: var(--vscode-foreground); }
#findings-table tr:hover td { background: var(--vscode-list-hoverBackground); }
#findings-table td { padding: 5px 10px; border-bottom: 1px solid var(--vscode-widget-border); vertical-align: middle; }
.sev { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #fff; }
.sev-critical { background: #f44747; }
.sev-high     { background: #ff9900; }
.sev-medium   { background: #3794ff; }
.sev-low      { background: #89d185; color: #1a1a1a; }
.cat { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 10px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
.file-link { color: var(--vscode-textLink-foreground); cursor: pointer; font-family: var(--vscode-editor-font-family); font-size: 11px; }
.file-link:hover { text-decoration: underline; }
.claim-cell { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.act-cell { display: flex; gap: 4px; white-space: nowrap; }
.act { padding: 2px 7px; font-size: 11px; border: none; border-radius: 3px; cursor: pointer; font-family: var(--vscode-font-family); }
.act-view { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
.act-view:hover { background: var(--vscode-button-secondaryHoverBackground); }
.act-fix  { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
.act-fix:hover  { background: var(--vscode-button-hoverBackground); }
.no-results { text-align: center; padding: 24px; color: var(--vscode-descriptionForeground); }

/* â”€â”€ Empty / loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.empty { text-align: center; padding: 60px 20px; color: var(--vscode-descriptionForeground); }
.empty p { margin-top: 10px; font-size: 13px; }
.empty button { margin-top: 16px; }
</style>
</head>
<body>

<div id="header">
  <span class="header-title">&#128065; TruthLens</span>
  <div id="hdr-stats" class="header-stats"></div>
  <div id="hdr-meta" class="header-meta"></div>
  <button class="btn" data-action="runAudit" title="Best time to audit: after a batch of fixes, before a PR/code review, or after significant refactoring. Avoid auditing after every individual fix — batch your changes first to save credits.">&#9654; Re-run Audit</button>
  <button class="btn btn-sec" data-action="fixAllOpen" title="Send one /fix-all prompt to Bob for every open finding. Commit first; large batches can take a while.">Fix all open</button>
</div>

<div id="main"></div>

<script id="initial-report" type="application/json">${reportJson}</script>
<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}

	private dispose(): void {
		DashboardPanel.currentPanel = undefined;
		this.panel.dispose();
		for (const d of this.disposables) { d.dispose(); }
		this.disposables = [];
	}
}
