import * as vscode from 'vscode';
import { Finding, FindingsReport } from './types';
import { invokeBobChatWithPrompt } from './audit';

/**
 * Trigger Bob to fix a specific finding, with pre-fix confirmation.
 */
export async function runFix(
	finding: Finding,
	preferredStrategy: string | undefined,
	log: (msg: string) => void
): Promise<void> {
	const strategy = resolveStrategy(finding, preferredStrategy);
	const strategyLabel = getStrategyLabel(strategy);

	log(`[fix] Starting fix for ${finding.id} — strategy: ${strategy}`);

	const confirmed = await showFixConfirmation(finding, strategyLabel);
	if (!confirmed) {
		log(`[fix] User cancelled fix for ${finding.id}`);
		return;
	}

	const bobFlag = (strategy === 'fix_implementation' || strategy === 'add_validation')
		? 'implement'
		: 'rename';
	const prompt = `/fix-claim ${finding.id} --strategy ${bobFlag}`;
	log(`[fix] Bob prompt: ${prompt}`);

	try {
		await invokeBobChatWithPrompt(
			prompt,
			log,
			`Bob chat is open. Paste and press Enter to fix ${finding.id}.`,
			'After Bob finishes, fix any remaining findings in the same chat session.\n\n' +
			'When done, open a NEW Bob chat and run /audit to refresh findings.json.\n\n' +
			'Tip: Batch all your fixes before re-auditing — each audit uses credits.'
		);
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		log(`[fix] ERROR: ${msg}`);
		throw error;
	}
}

/**
 * Prompt Bob to fix every open finding in one batch.
 */
export async function runFixAll(
	openFindings: Finding[],
	log: (msg: string) => void
): Promise<void> {
	log(`[fix-all] Starting batch fix for ${openFindings.length} open finding(s)`);

	const confirmed = await showFixAllConfirmation(openFindings);
	if (!confirmed) {
		log('[fix-all] User cancelled');
		return;
	}

	log('[fix-all] Sending /fix-all to Bob chat');

	try {
		await invokeBobChatWithPrompt(
			'/fix-all',
			log,
			'Bob chat is open. Paste and press Enter to fix all open findings.',
			'Bob will walk through each open finding using strategies from findings.json.\n\n' +
			'When finished, run /audit in a new chat to refresh findings.json.'
		);
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		log(`[fix-all] ERROR: ${msg}`);
		throw error;
	}
}

async function showFixAllConfirmation(openFindings: Finding[]): Promise<boolean> {
	const bySev = { critical: 0, high: 0, medium: 0, low: 0 };
	for (const f of openFindings) {
		bySev[f.severity]++;
	}
	const sevLines = Object.entries(bySev)
		.filter(([, n]) => n > 0)
		.map(([s, n]) => `  • ${s}: ${n}`)
		.join('\n');

	const result = await vscode.window.showWarningMessage(
		`Fix all ${openFindings.length} open finding${openFindings.length !== 1 ? 's' : ''} with Bob?`,
		{
			modal: true,
			detail: [
				`Bob may edit many files. Commit or stash first if you want an easy rollback.`,
				``,
				`Breakdown:`,
				sevLines || '  • (none)',
				``,
				`This sends a single /fix-all prompt (batch session).`,
			].join('\n')
		},
		'Fix All',
		'Cancel'
	);

	return result === 'Fix All';
}

/**
 * Modal confirmation before Bob makes any changes.
 */
async function showFixConfirmation(finding: Finding, strategyLabel: string): Promise<boolean> {
	const effort = finding.suggestedFix.estimatedEffort
		? ` · ${finding.suggestedFix.estimatedEffort} effort`
		: '';
	const { callerCount, affectedFiles } = finding.blastRadius;

	const blastLines: string[] = [];
	if (callerCount > 0 || affectedFiles.length > 0) {
		blastLines.push('');
		blastLines.push(`Blast radius: ${callerCount} caller${callerCount !== 1 ? 's' : ''}, ${affectedFiles.length} affected file${affectedFiles.length !== 1 ? 's' : ''}`);
		for (const f of affectedFiles) {
			blastLines.push(`  • ${f}`);
		}
	}

	const result = await vscode.window.showWarningMessage(
		`Fix ${finding.id}${effort}`,
		{
			modal: true,
			detail: [
				`Strategy: ${strategyLabel}`,
				``,
				`Action: ${finding.suggestedFix.summary}`,
				...blastLines,
				``,
				`Bob will be prompted to apply this fix. Changes can be reverted via git.`
			].join('\n')
		},
		'Apply Fix'
	);

	return result === 'Apply Fix';
}

/**
 * Update findings.json to mark a finding as resolved.
 */
export async function markFindingResolved(
	findingId: string,
	workspaceFolder: vscode.WorkspaceFolder,
	log: (msg: string) => void
): Promise<boolean> {
	const findingsUri = vscode.Uri.joinPath(workspaceFolder.uri, '.truthlens', 'findings.json');

	try {
		const data = await vscode.workspace.fs.readFile(findingsUri);
		const text = new TextDecoder('utf-8').decode(data).replace(/^﻿/, '');
		const report: FindingsReport = JSON.parse(text);

		const finding = report.findings.find(f => f.id === findingId);
		if (!finding) {
			vscode.window.showErrorMessage(`TruthLens: Finding ${findingId} not found in findings.json`);
			return false;
		}

		if (finding.status === 'resolved') {
			vscode.window.showInformationMessage(`TruthLens: ${findingId} is already resolved.`);
			return true;
		}

		finding.status = 'resolved';
		finding.resolvedAt = new Date().toISOString();
		finding.resolvedBy = 'truthlens.fix';

		recomputeSummary(report);
		await vscode.workspace.fs.writeFile(findingsUri, new TextEncoder().encode(JSON.stringify(report, null, 2)));
		log(`[fix] Marked ${findingId} as resolved in findings.json`);
		return true;
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		log(`[fix] Failed to update findings.json: ${msg}`);
		vscode.window.showErrorMessage(`TruthLens: Failed to mark ${findingId} resolved — ${msg}`);
		return false;
	}
}

/**
 * Mark a finding as dismissed in findings.json (false positive / won't fix).
 */
export async function dismissFinding(
	findingId: string,
	workspaceFolder: vscode.WorkspaceFolder,
	log: (msg: string) => void
): Promise<boolean> {
	const findingsUri = vscode.Uri.joinPath(workspaceFolder.uri, '.truthlens', 'findings.json');

	try {
		const data = await vscode.workspace.fs.readFile(findingsUri);
		const text = new TextDecoder('utf-8').decode(data).replace(/^﻿/, '');
		const report: FindingsReport = JSON.parse(text);

		const finding = report.findings.find(f => f.id === findingId);
		if (!finding) {
			vscode.window.showErrorMessage(`TruthLens: Finding ${findingId} not found in findings.json`);
			return false;
		}

		if (finding.status === 'dismissed') {
			vscode.window.showInformationMessage(`TruthLens: ${findingId} is already dismissed.`);
			return true;
		}

		finding.status = 'dismissed';
		finding.resolvedAt = new Date().toISOString();
		finding.resolvedBy = 'truthlens.dismiss';

		recomputeSummary(report);
		await vscode.workspace.fs.writeFile(findingsUri, new TextEncoder().encode(JSON.stringify(report, null, 2)));
		log(`[fix] Marked ${findingId} as dismissed in findings.json`);
		return true;
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		log(`[fix] Failed to update findings.json: ${msg}`);
		vscode.window.showErrorMessage(`TruthLens: Failed to dismiss ${findingId} — ${msg}`);
		return false;
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function recomputeSummary(report: FindingsReport): void {
	const open = report.findings.filter(f => f.status === 'open');
	report.summary.total    = open.length;
	report.summary.critical = open.filter(f => f.severity === 'critical').length;
	report.summary.high     = open.filter(f => f.severity === 'high').length;
	report.summary.medium   = open.filter(f => f.severity === 'medium').length;
	report.summary.low      = open.filter(f => f.severity === 'low').length;
	report.summary.byCategory['CAT-A'] = open.filter(f => f.category === 'CAT-A').length;
	report.summary.byCategory['CAT-B'] = open.filter(f => f.category === 'CAT-B').length;
	report.summary.byCategory['CAT-C'] = open.filter(f => f.category === 'CAT-C').length;
	report.summary.byCategory['CAT-D'] = open.filter(f => f.category === 'CAT-D').length;
}

function resolveStrategy(finding: Finding, preferred: string | undefined): string {
	const valid = new Set(['rename_artifact', 'fix_implementation', 'update_documentation', 'add_validation']);
	return (preferred && valid.has(preferred)) ? preferred : finding.suggestedFix.strategy;
}

function getStrategyLabel(strategy: string): string {
	const labels: Record<string, string> = {
		rename_artifact:      'Rename Artifact',
		fix_implementation:   'Fix Implementation',
		update_documentation: 'Update Documentation',
		add_validation:       'Add Validation',
	};
	return labels[strategy] || strategy;
}
