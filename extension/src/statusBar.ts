import * as vscode from 'vscode';
import { FindingsReport, SeverityLevel } from './types';

/**
 * Manages the TruthLens status bar item
 */
export class StatusBarManager {
	private statusBarItem: vscode.StatusBarItem;

	constructor() {
		this.statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left,
			100
		);
		this.statusBarItem.command = 'truthlens.openDashboard';
		this.statusBarItem.show();
	}

	/**
	 * Update status bar with findings data
	 */
	update(findings: FindingsReport | null): void {
		if (!findings || findings.summary.total === 0) {
			this.statusBarItem.text = '$(eye) TruthLens: No violations';
			this.statusBarItem.tooltip = 'No claim violations found';
			this.statusBarItem.backgroundColor = undefined;
			return;
		}

		const total = findings.summary.total;
		const { critical, high, medium, low } = findings.summary;

		// Set text
		this.statusBarItem.text = `$(eye) TruthLens: ${total} ${total === 1 ? 'violation' : 'violations'}`;

		// Set tooltip with breakdown
		const tooltip = new vscode.MarkdownString();
		tooltip.appendMarkdown(`**TruthLens Findings**\n\n`);
		tooltip.appendMarkdown(`Total: ${total}\n\n`);
		
		if (critical > 0) {
			tooltip.appendMarkdown(`$(error) Critical: ${critical}\n\n`);
		}
		if (high > 0) {
			tooltip.appendMarkdown(`$(warning) High: ${high}\n\n`);
		}
		if (medium > 0) {
			tooltip.appendMarkdown(`$(info) Medium: ${medium}\n\n`);
		}
		if (low > 0) {
			tooltip.appendMarkdown(`$(circle-outline) Low: ${low}\n\n`);
		}
		
		tooltip.appendMarkdown(`\nClick to open dashboard`);
		this.statusBarItem.tooltip = tooltip;

		// Set background color based on highest severity
		if (critical > 0) {
			this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
		} else if (high > 0) {
			this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
		} else {
			this.statusBarItem.backgroundColor = undefined;
		}
	}

	/**
	 * Show the status bar item
	 */
	show(): void {
		this.statusBarItem.show();
	}

	/**
	 * Hide the status bar item
	 */
	hide(): void {
		this.statusBarItem.hide();
	}

	/**
	 * Dispose of the status bar item
	 */
	dispose(): void {
		this.statusBarItem.dispose();
	}
}

// Made with Bob
