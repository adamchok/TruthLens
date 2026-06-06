import * as vscode from 'vscode';
import { Finding } from './types';

export class FindingDetailPanel {
	private static currentPanel: FindingDetailPanel | undefined;
	private readonly panel: vscode.WebviewPanel;
	private readonly extensionUri: vscode.Uri;
	private disposables: vscode.Disposable[] = [];
	private currentFinding: Finding;

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, finding: Finding) {
		this.panel = panel;
		this.extensionUri = extensionUri;
		this.currentFinding = finding;

		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

		this.panel.webview.onDidReceiveMessage(
			async (message: { type: string; findingId?: string; strategy?: string }) => {
				switch (message.type) {
					case 'fixArtifact':
						await vscode.commands.executeCommand('truthlens.fix', message.findingId, message.strategy ?? 'rename_artifact');
						break;
					case 'fixCode':
						await vscode.commands.executeCommand('truthlens.fix', message.findingId, message.strategy ?? 'fix_implementation');
						break;
					case 'markResolved':
						await vscode.commands.executeCommand('truthlens.markResolved', message.findingId);
						break;
					case 'openFile':
						await vscode.commands.executeCommand('truthlens.openFinding', this.currentFinding);
						break;
					case 'dismiss':
						await vscode.commands.executeCommand('truthlens.dismissFinding', message.findingId);
						break;
				}
			},
			null,
			this.disposables
		);

		this.update(finding);
	}

	static show(finding: Finding, extensionUri: vscode.Uri): void {
		const column = vscode.ViewColumn.Beside;

		if (FindingDetailPanel.currentPanel) {
			FindingDetailPanel.currentPanel.panel.reveal(column);
			FindingDetailPanel.currentPanel.update(finding);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'truthlensFindingDetail',
			`Finding: ${finding.id}`,
			column,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
			}
		);

		FindingDetailPanel.currentPanel = new FindingDetailPanel(panel, extensionUri, finding);
	}

	private update(finding: Finding): void {
		this.currentFinding = finding;
		this.panel.title = `Finding: ${finding.id}`;
		this.panel.webview.html = this.getHtml(finding);
	}

	private getHtml(finding: Finding): string {
		const webview = this.panel.webview;
		const nonce = this.getNonce();
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.extensionUri, 'media', 'findingDetail.js')
		);
		const csp = webview.cspSource;

		const severityColor = this.getSeverityColor(finding.severity);
		const categoryName = this.getCategoryName(finding.category);
		const confidencePct = (finding.confidence * 100).toFixed(0);
		const evidenceItems = Array.isArray(finding.reality.evidence)
			? finding.reality.evidence
			: [finding.reality.evidence];
		const evidenceHtml = evidenceItems
			.map(e => `<li><code>${this.esc(e)}</code></li>`)
			.join('\n');
		const affectedFilesHtml = finding.blastRadius.affectedFiles
			.map(f => `<li>${this.esc(f)}</li>`)
			.join('\n');
		const strategyLabel = this.getStrategyLabel(finding.suggestedFix.strategy);
		const isResolved = finding.status === 'resolved';
		const isDismissed = finding.status === 'dismissed';

		const actionButtons = isResolved
			? `<button class="btn-secondary" data-action="openFile">Go to File</button>
			   <span class="resolved-badge">&#10003; Resolved</span>`
			: isDismissed
			? `<button class="btn-secondary" data-action="openFile">Go to File</button>
			   <span class="dismissed-badge">&#8709; Dismissed</span>`
			: `<button class="btn-primary" data-action="fixArtifact">Fix: Rename Artifact</button>
			   <button class="btn-primary" data-action="fixCode">Fix: Update Implementation</button>
			   <button class="btn-secondary" data-action="markResolved">Mark Resolved</button>
			   <button class="btn-secondary" data-action="openFile">Go to File</button>
			   <button class="btn-secondary" data-action="dismiss">Dismiss</button>`;

		const findingJson = JSON.stringify(finding).replace(/<\//g, '<\\/');

		return /*html*/`<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy"
		content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}' ${csp};">
	<title>Finding ${this.esc(finding.id)}</title>
	<style>
		body {
			font-family: var(--vscode-font-family);
			color: var(--vscode-foreground);
			background: var(--vscode-editor-background);
			padding: 20px;
			line-height: 1.6;
		}
		.header {
			display: flex;
			align-items: center;
			gap: 12px;
			margin-bottom: 24px;
			padding-bottom: 16px;
			border-bottom: 1px solid var(--vscode-widget-border);
		}
		.severity-badge {
			display: inline-block;
			padding: 4px 12px;
			border-radius: 4px;
			font-size: 12px;
			font-weight: 600;
			text-transform: uppercase;
			color: #fff;
			background: ${severityColor};
		}
		.finding-id { font-size: 20px; font-weight: 600; }
		.category-tag {
			font-size: 12px;
			padding: 3px 8px;
			border-radius: 3px;
			background: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
		}
		.section { margin-bottom: 20px; }
		.section h3 {
			margin: 0 0 8px 0;
			font-size: 13px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			color: var(--vscode-descriptionForeground);
		}
		.claim-box, .reality-box {
			padding: 12px 16px;
			border-radius: 6px;
			margin-bottom: 12px;
		}
		.claim-box {
			background: var(--vscode-textBlockQuote-background);
			border-left: 3px solid var(--vscode-textLink-foreground);
		}
		.reality-box {
			background: var(--vscode-inputValidation-errorBackground, rgba(255,0,0,0.1));
			border-left: 3px solid ${severityColor};
		}
		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
			gap: 12px;
			margin-bottom: 20px;
		}
		.stat-card {
			padding: 12px;
			border-radius: 6px;
			background: var(--vscode-textBlockQuote-background);
			text-align: center;
		}
		.stat-value { font-size: 24px; font-weight: 700; }
		.stat-label {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
			text-transform: uppercase;
			letter-spacing: 0.3px;
		}
		ul { padding-left: 20px; }
		li { margin-bottom: 4px; }
		code {
			font-family: var(--vscode-editor-font-family);
			font-size: var(--vscode-editor-font-size);
			background: var(--vscode-textCodeBlock-background);
			padding: 2px 6px;
			border-radius: 3px;
		}
		.actions {
			display: flex;
			gap: 8px;
			margin-top: 24px;
			padding-top: 16px;
			border-top: 1px solid var(--vscode-widget-border);
			flex-wrap: wrap;
			align-items: center;
		}
		button {
			padding: 8px 16px;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: 13px;
			font-family: var(--vscode-font-family);
		}
		.btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
		.btn-primary:hover { background: var(--vscode-button-hoverBackground); }
		.btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
		.btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
		.file-link {
			color: var(--vscode-textLink-foreground);
			cursor: pointer;
			text-decoration: underline;
		}
		.suggested-fix {
			padding: 12px 16px;
			border-radius: 6px;
			background: var(--vscode-textBlockQuote-background);
			border-left: 3px solid var(--vscode-charts-green);
		}
		.effort-badge {
			display: inline-block;
			padding: 2px 8px;
			border-radius: 3px;
			font-size: 11px;
			background: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
		}
		.resolved-badge {
			font-size: 13px;
			font-weight: 600;
			color: var(--vscode-charts-green, #89d185);
		}
		.dismissed-badge {
			font-size: 13px;
			font-weight: 600;
			color: var(--vscode-descriptionForeground);
		}
	</style>
</head>
<body>
	<div class="header">
		<span class="severity-badge">${this.esc(finding.severity)}</span>
		<span class="finding-id">${this.esc(finding.id)}</span>
		<span class="category-tag">${this.esc(categoryName)}</span>
	</div>

	<div class="section">
		<h3>Location</h3>
		<p><span class="file-link" data-action="openFile">${this.esc(finding.file)}:${finding.line}</span>
		${finding.endLine ? ` — line ${finding.line} to ${finding.endLine}` : ''}</p>
	</div>

	<div class="section">
		<h3>The Claim</h3>
		<div class="claim-box">
			<strong>${this.esc(finding.claim.source)}:</strong>
			<code>${this.esc(finding.claim.extractedFrom)}</code><br>
			<em>"${this.esc(finding.claim.text)}"</em>
		</div>
	</div>

	<div class="section">
		<h3>The Reality</h3>
		<div class="reality-box">${this.esc(finding.reality.description)}</div>
	</div>

	<div class="section">
		<h3>Evidence</h3>
		<ul>${evidenceHtml}</ul>
	</div>

	<div class="stats-grid">
		<div class="stat-card">
			<div class="stat-value">${confidencePct}%</div>
			<div class="stat-label">Confidence</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">${finding.blastRadius.callerCount}</div>
			<div class="stat-label">Callers Affected</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">${finding.blastRadius.affectedFiles.length}</div>
			<div class="stat-label">Files Affected</div>
		</div>
	</div>

	${affectedFilesHtml ? `
	<div class="section">
		<h3>Affected Files</h3>
		<ul>${affectedFilesHtml}</ul>
	</div>
	` : ''}

	<div class="section">
		<h3>Suggested Fix</h3>
		<div class="suggested-fix">
			<strong>${this.esc(strategyLabel)}:</strong>
			${this.esc(finding.suggestedFix.summary)}
			${finding.suggestedFix.estimatedEffort
				? `<br><span class="effort-badge">Effort: ${this.esc(finding.suggestedFix.estimatedEffort)}</span>`
				: ''}
		</div>
	</div>

	<div class="actions">
		${actionButtons}
	</div>

	<script id="finding-data" type="application/json">${findingJson}</script>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}

	private getNonce(): string {
		let text = '';
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) {
			text += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return text;
	}

	private esc(text: string): string {
		return String(text)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	private getSeverityColor(severity: string): string {
		const colors: Record<string, string> = {
			critical: '#f44747',
			high:     '#ff9900',
			medium:   '#3794ff',
			low:      '#89d185',
		};
		return colors[severity] || '#888';
	}

	private getCategoryName(category: string): string {
		const names: Record<string, string> = {
			'CAT-A': 'Function Name Mismatch',
			'CAT-B': 'Docstring Mismatch',
			'CAT-C': 'Test Name Mismatch',
			'CAT-D': 'Documentation Mismatch',
		};
		return names[category] || category;
	}

	private getStrategyLabel(strategy: string): string {
		const labels: Record<string, string> = {
			rename_artifact:      'Rename Artifact',
			fix_implementation:   'Fix Implementation',
			update_documentation: 'Update Documentation',
			add_validation:       'Add Validation',
		};
		return labels[strategy] || strategy;
	}

	private dispose(): void {
		FindingDetailPanel.currentPanel = undefined;
		this.panel.dispose();
		for (const d of this.disposables) { d.dispose(); }
		this.disposables = [];
	}
}
