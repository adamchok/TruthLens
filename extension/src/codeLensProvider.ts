import * as vscode from 'vscode';
import { Finding, FindingsReport } from './types';

export class FindingsCodeLensProvider implements vscode.CodeLensProvider {
	private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
	readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

	private findings: FindingsReport | null = null;
	private workspaceRoot: string | undefined;

	constructor() {
		this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	}

	updateFindings(findings: FindingsReport | null): void {
		this.findings = findings;
		this._onDidChangeCodeLenses.fire();
	}

	provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
		const style = vscode.workspace.getConfiguration('truthlens').get<string>('decorationStyle', 'both');
		if (style === 'decoration') {
			return [];
		}

		const matchingFindings = this.getFindingsForDocument(document);
		return matchingFindings.map(finding => {
			const line = Math.max(0, finding.line - 1);
			const range = new vscode.Range(line, 0, line, 0);

			const categoryLabel = this.getCategoryLabel(finding.category);
			const title = `$(warning) Claim violated: ${finding.claim.text} — ${categoryLabel}`;

			return new vscode.CodeLens(range, {
				title,
				command: 'truthlens.showFindingDetail',
				arguments: [finding],
				tooltip: `${finding.id}: ${finding.reality.description}`
			});
		});
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

	private getCategoryLabel(category: string): string {
		const labels: Record<string, string> = {
			'CAT-A': 'Function Name Mismatch',
			'CAT-B': 'Docstring Mismatch',
			'CAT-C': 'Test Name Mismatch',
			'CAT-D': 'Documentation Mismatch'
		};
		return labels[category] || category;
	}

	dispose(): void {
		this._onDidChangeCodeLenses.dispose();
	}
}
