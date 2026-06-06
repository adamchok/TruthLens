import * as vscode from 'vscode';
import { Finding, FindingsReport, SeverityLevel } from './types';

interface SeverityDecorationSet {
	lineDecoration: vscode.TextEditorDecorationType;
	gutterDecoration: vscode.TextEditorDecorationType;
}

export class DecorationProvider implements vscode.Disposable {
	private decorationTypes: Map<SeverityLevel, SeverityDecorationSet> = new Map();
	private findings: FindingsReport | null = null;
	private workspaceRoot: string | undefined;
	private disposables: vscode.Disposable[] = [];

	constructor() {
		this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		this.createDecorationTypes();

		this.disposables.push(
			vscode.window.onDidChangeActiveTextEditor(editor => {
				if (editor) {
					this.applyDecorations(editor);
				}
			}),
			vscode.window.onDidChangeVisibleTextEditors(editors => {
				for (const editor of editors) {
					this.applyDecorations(editor);
				}
			})
		);
	}

	private createDecorationTypes(): void {
		const severityConfig: Record<SeverityLevel, { color: string; gutterIcon: string }> = {
			critical: { color: '#f44747', gutterIcon: 'error' },
			high:     { color: '#ff9900', gutterIcon: 'warning' },
			medium:   { color: '#3794ff', gutterIcon: 'info' },
			low:      { color: '#89d185', gutterIcon: 'circle-outline' },
		};

		for (const [severity, config] of Object.entries(severityConfig)) {
			const lineDecoration = vscode.window.createTextEditorDecorationType({
				isWholeLine: false,
				borderWidth: '0 0 2px 0',
				borderStyle: 'wavy',
				borderColor: config.color,
				overviewRulerColor: config.color,
				overviewRulerLane: vscode.OverviewRulerLane.Right,
				light: {
					borderColor: config.color,
				},
				dark: {
					borderColor: config.color,
				}
			});

			const gutterDecoration = vscode.window.createTextEditorDecorationType({
				gutterIconPath: undefined,
				gutterIconSize: 'contain',
			});

			this.decorationTypes.set(severity as SeverityLevel, {
				lineDecoration,
				gutterDecoration,
			});
		}
	}

	updateFindings(findings: FindingsReport | null): void {
		this.findings = findings;
		this.refreshAllEditors();
	}

	refreshAllEditors(): void {
		for (const editor of vscode.window.visibleTextEditors) {
			this.applyDecorations(editor);
		}
	}

	private applyDecorations(editor: vscode.TextEditor): void {
		const style = vscode.workspace.getConfiguration('truthlens').get<string>('decorationStyle', 'both');
		if (style === 'codelens') {
			this.clearDecorations(editor);
			return;
		}

		const matchingFindings = this.getFindingsForDocument(editor.document);

		const bySeverity = new Map<SeverityLevel, vscode.DecorationOptions[]>();
		for (const severity of ['critical', 'high', 'medium', 'low'] as SeverityLevel[]) {
			bySeverity.set(severity, []);
		}

		for (const finding of matchingFindings) {
			const startLine = Math.max(0, finding.line - 1);
			const endLine = finding.endLine ? finding.endLine - 1 : startLine;

			const startPos = new vscode.Position(startLine, 0);
			const lineText = editor.document.lineAt(startLine).text;
			const endPos = new vscode.Position(endLine, lineText.length);

			const hoverMessage = this.createHoverMarkdown(finding);

			const decoration: vscode.DecorationOptions = {
				range: new vscode.Range(startPos, endPos),
				hoverMessage,
			};

			bySeverity.get(finding.severity)?.push(decoration);
		}

		for (const [severity, decorations] of bySeverity) {
			const decorationSet = this.decorationTypes.get(severity);
			if (decorationSet) {
				editor.setDecorations(decorationSet.lineDecoration, decorations);
			}
		}
	}

	private clearDecorations(editor: vscode.TextEditor): void {
		for (const decorationSet of this.decorationTypes.values()) {
			editor.setDecorations(decorationSet.lineDecoration, []);
			editor.setDecorations(decorationSet.gutterDecoration, []);
		}
	}

	private createHoverMarkdown(finding: Finding): vscode.MarkdownString {
		const md = new vscode.MarkdownString();
		md.isTrusted = true;
		md.supportHtml = true;

		const severityIcon = this.getSeverityIcon(finding.severity);
		const categoryName = this.getCategoryName(finding.category);

		md.appendMarkdown(`### ${severityIcon} ${finding.id} — ${categoryName}\n\n`);
		md.appendMarkdown(`**Claim:** ${finding.claim.text}\n\n`);
		md.appendMarkdown(`**Reality:** ${finding.reality.description}\n\n`);

		const evidenceItems = Array.isArray(finding.reality.evidence)
			? finding.reality.evidence
			: [finding.reality.evidence];
		if (evidenceItems.length > 0) {
			md.appendMarkdown(`**Evidence:**\n`);
			for (const ev of evidenceItems) {
				md.appendMarkdown(`- \`${ev}\`\n`);
			}
			md.appendMarkdown(`\n`);
		}

		md.appendMarkdown(`**Confidence:** ${(finding.confidence * 100).toFixed(0)}% · `);
		md.appendMarkdown(`**Severity:** ${finding.severity} · `);
		md.appendMarkdown(`**Blast Radius:** ${finding.blastRadius.callerCount} callers\n\n`);

		md.appendMarkdown(`**Suggested fix:** ${finding.suggestedFix.summary}\n\n`);

		const detailArgs = encodeURIComponent(JSON.stringify(finding));
		md.appendMarkdown(`[View Details](command:truthlens.showFindingDetail?${detailArgs}) · `);
		md.appendMarkdown(`[Fix with Bob](command:truthlens.fix?${encodeURIComponent(JSON.stringify(finding.id))})`);

		return md;
	}

	private getFindingsForDocument(document: vscode.TextDocument): Finding[] {
		if (!this.findings || !this.workspaceRoot) {
			return [];
		}

		const docPath = document.uri.fsPath;

		return this.findings.findings.filter(f => {
			if (f.status !== 'open') {
				return false;
			}
			const findingAbsolute = vscode.Uri.joinPath(
				vscode.Uri.file(this.workspaceRoot!),
				f.file
			).fsPath;
			return this.pathsEqual(docPath, findingAbsolute);
		});
	}

	private pathsEqual(a: string, b: string): boolean {
		const normalize = (p: string) => p.replace(/\\/g, '/').toLowerCase();
		return normalize(a) === normalize(b);
	}

	private getSeverityIcon(severity: SeverityLevel): string {
		const icons: Record<SeverityLevel, string> = {
			critical: '$(error)',
			high: '$(warning)',
			medium: '$(info)',
			low: '$(circle-outline)',
		};
		return icons[severity];
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

	dispose(): void {
		for (const decorationSet of this.decorationTypes.values()) {
			decorationSet.lineDecoration.dispose();
			decorationSet.gutterDecoration.dispose();
		}
		for (const d of this.disposables) {
			d.dispose();
		}
	}
}
