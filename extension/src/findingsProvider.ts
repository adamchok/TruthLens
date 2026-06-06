import * as vscode from 'vscode';
import * as path from 'path';
import { Finding, FindingsReport, SeverityLevel } from './types';

/**
 * Tree item representing a node in the findings tree
 */
export class FindingTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly finding?: Finding,
		public readonly severity?: SeverityLevel
	) {
		super(label, collapsibleState);
		
		if (finding) {
			// Individual finding node
			this.tooltip = this.createTooltip(finding);
			this.description = `${finding.file}:${finding.line}`;
			this.iconPath = this.getIconForSeverity(finding.severity);
			this.contextValue = 'finding';
			
			// Make clickable to jump to file
			this.command = {
				command: 'truthlens.openFinding',
				title: 'Open Finding',
				arguments: [finding]
			};
		} else if (severity) {
			// Severity group node
			this.iconPath = this.getIconForSeverity(severity);
			this.contextValue = 'severityGroup';
		}
	}

	private createTooltip(finding: Finding): vscode.MarkdownString {
		const tooltip = new vscode.MarkdownString();
		tooltip.isTrusted = true;
		
		tooltip.appendMarkdown(`**${finding.id}** - ${this.getCategoryName(finding.category)}\n\n`);
		tooltip.appendMarkdown(`**Claim:** ${finding.claim.text}\n\n`);
		tooltip.appendMarkdown(`**Reality:** ${finding.reality.description}\n\n`);
		tooltip.appendMarkdown(`**Confidence:** ${(finding.confidence * 100).toFixed(0)}%\n\n`);
		tooltip.appendMarkdown(`**Blast Radius:** ${finding.blastRadius.callerCount} callers\n\n`);
		
		return tooltip;
	}

	private getCategoryName(category: string): string {
		const names: Record<string, string> = {
			'CAT-A': 'Function Name Mismatch',
			'CAT-B': 'Docstring Mismatch',
			'CAT-C': 'Test Name Mismatch',
			'CAT-D': 'Documentation Mismatch'
		};
		return names[category] || category;
	}

	private getIconForSeverity(severity: SeverityLevel): vscode.ThemeIcon {
		const icons: Record<SeverityLevel, string> = {
			critical: 'error',
			high: 'warning',
			medium: 'info',
			low: 'circle-outline'
		};
		return new vscode.ThemeIcon(icons[severity]);
	}
}

/**
 * Provides tree data for the TruthLens findings view
 */
export class FindingsProvider implements vscode.TreeDataProvider<FindingTreeItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<FindingTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private findings: FindingsReport | null = null;
	private workspaceRoot: string | undefined;
	private log: (message: string) => void;

	constructor(private context: vscode.ExtensionContext, logger?: (message: string) => void) {
		this.log = logger || ((msg: string) => console.log(`[TruthLens] ${msg}`));
		this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		this.log(`FindingsProvider initialized, workspaceRoot: ${this.workspaceRoot || 'undefined'}`);
	}

	/**
	 * Refresh the tree view
	 */
	async refresh(): Promise<void> {
		await this.loadFindings();
		this._onDidChangeTreeData.fire();
	}

	/**
	 * Load findings from .truthlens/findings.json
	 */
	private async loadFindings(): Promise<void> {
		if (!this.workspaceRoot) {
			this.log('loadFindings: no workspaceRoot set, skipping');
			this.findings = null;
			return;
		}

		const filePath = path.join(this.workspaceRoot, '.truthlens', 'findings.json');
		this.log(`loadFindings: attempting to read ${filePath}`);

		try {
			const findingsPath = vscode.Uri.file(filePath);
			const data = await vscode.workspace.fs.readFile(findingsPath);
			const text = new TextDecoder('utf-8').decode(data).replace(/^﻿/, '');
			this.findings = JSON.parse(text) as FindingsReport;
			this.log(`loadFindings: loaded ${this.findings.findings.length} findings (${this.findings.summary.total} total)`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.log(`loadFindings ERROR: ${message}`);
			this.findings = null;
		}
	}

	/**
	 * Get tree item for a node
	 */
	getTreeItem(element: FindingTreeItem): vscode.TreeItem {
		return element;
	}

	/**
	 * Get children for a node
	 */
	async getChildren(element?: FindingTreeItem): Promise<FindingTreeItem[]> {
		if (!this.workspaceRoot) {
			return [this.createMessageItem('No workspace folder open')];
		}

		// Load findings if not already loaded
		if (!this.findings) {
			await this.loadFindings();
		}

		if (!this.findings) {
			return [this.createMessageItem('Run TruthLens: Audit Repository to begin', 'truthlens.audit')];
		}

		// Root level: show severity groups
		if (!element) {
			return this.getSeverityGroups();
		}

		// Severity group level: show findings
		if (element.severity) {
			return this.getFindingsForSeverity(element.severity);
		}

		return [];
	}

	/**
	 * Create severity group nodes
	 */
	private getSeverityGroups(): FindingTreeItem[] {
		if (!this.findings) {
			return [];
		}

		const groups: FindingTreeItem[] = [];
		const severities: SeverityLevel[] = ['critical', 'high', 'medium', 'low'];

		for (const severity of severities) {
			const count = this.findings.summary[severity];
			if (count > 0) {
				const label = `${this.capitalize(severity)} (${count})`;
				const item = new FindingTreeItem(
					label,
					vscode.TreeItemCollapsibleState.Expanded,
					undefined,
					severity
				);
				groups.push(item);
			}
		}

		return groups;
	}

	/**
	 * Get findings for a specific severity level
	 */
	private getFindingsForSeverity(severity: SeverityLevel): FindingTreeItem[] {
		if (!this.findings) {
			return [];
		}

		const findings = this.findings.findings
			.filter(f => f.severity === severity && f.status === 'open')
			.map(f => {
				const label = `${f.id}: ${f.claim.extractedFrom}`;
				return new FindingTreeItem(
					label,
					vscode.TreeItemCollapsibleState.None,
					f
				);
			});

		return findings;
	}

	/**
	 * Create a message item (for empty states)
	 */
	private createMessageItem(message: string, command?: string): FindingTreeItem {
		const item = new FindingTreeItem(message, vscode.TreeItemCollapsibleState.None);
		item.contextValue = 'message';
		
		if (command) {
			item.command = {
				command,
				title: message
			};
		}
		
		return item;
	}

	/**
	 * Capitalize first letter
	 */
	private capitalize(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	/**
	 * Get current findings report
	 */
	getFindings(): FindingsReport | null {
		return this.findings;
	}
}
