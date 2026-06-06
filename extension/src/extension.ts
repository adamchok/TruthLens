import * as vscode from 'vscode';
import { FindingsProvider } from './findingsProvider';
import { StatusBarManager } from './statusBar';
import { FindingsCodeLensProvider } from './codeLensProvider';
import { DecorationProvider } from './decorationProvider';
import { FindingDetailPanel } from './findingDetailPanel';
import { Finding } from './types';
import { runAudit } from './audit';
import { runFix, runFixAll, markFindingResolved, dismissFinding } from './fix';
import { DashboardPanel } from './dashboard';

const OUTPUT_CHANNEL_NAME = 'TruthLens';
let outputChannel: vscode.OutputChannel;
let findingsProvider: FindingsProvider;
let statusBarManager: StatusBarManager;
let codeLensProvider: FindingsCodeLensProvider;
let decorationProvider: DecorationProvider;
let fileWatcher: vscode.FileSystemWatcher | undefined;

export async function activate(context: vscode.ExtensionContext) {
	outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
	log('TruthLens extension activating...');

	try {
		// Initialize UI components
		findingsProvider = new FindingsProvider(context, log);
		statusBarManager = new StatusBarManager();

		// Register tree view
		const treeView = vscode.window.createTreeView('truthlensFindings', {
			treeDataProvider: findingsProvider,
			showCollapseAll: true
		});
		context.subscriptions.push(treeView);

		// Register CodeLens provider for supported languages
		codeLensProvider = new FindingsCodeLensProvider();
		const codeLensSelector: vscode.DocumentSelector = [
			{ language: 'python' },
			{ language: 'javascript' },
			{ language: 'typescript' },
			{ language: 'markdown' },
		];
		context.subscriptions.push(
			vscode.languages.registerCodeLensProvider(codeLensSelector, codeLensProvider)
		);

		// Register decoration provider
		decorationProvider = new DecorationProvider();
		context.subscriptions.push(decorationProvider);

		// Re-apply decorations when settings change
		context.subscriptions.push(
			vscode.workspace.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration('truthlens.decorationStyle')) {
					log('Decoration style setting changed, refreshing');
					const findings = findingsProvider.getFindings();
					codeLensProvider.updateFindings(findings);
					decorationProvider.updateFindings(findings);
				}
			})
		);

		// Check if workspace is open
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			log('No workspace folder open, skipping scaffolding');
			registerCommands(context);
			return;
		}

		// Setup file watcher for findings.json
		setupFileWatcher(context, workspaceFolder);

		// Check if already scaffolded
		const isScaffolded = context.workspaceState.get<boolean>('truthlens.scaffolded', false);
		
		if (!isScaffolded) {
			log('First activation in this workspace, scaffolding Bob artifacts...');
			await scaffoldBobArtifacts(context, workspaceFolder);
			await context.workspaceState.update('truthlens.scaffolded', true);
			
			// Show welcome notification
			vscode.window.showInformationMessage(
				'TruthLens is ready. Run "TruthLens: Audit Repository" to begin.',
				'Audit Now'
			).then((selection: string | undefined) => {
				if (selection === 'Audit Now') {
					vscode.commands.executeCommand('truthlens.audit');
				}
			});
		} else {
			log('Workspace already scaffolded, skipping');
		}

		// Initial refresh of UI
		await refreshUI();

		// Register all commands
		registerCommands(context);

		// Add status bar to subscriptions
		context.subscriptions.push(statusBarManager);

		log('TruthLens extension activated successfully');
	} catch (error) {
		handleError('Extension activation failed', error);
	}
}

async function scaffoldBobArtifacts(
	context: vscode.ExtensionContext,
	workspaceFolder: vscode.WorkspaceFolder
): Promise<void> {
	try {
		const bobDir = vscode.Uri.joinPath(workspaceFolder.uri, '.bob');
		
		// Check if .bob directory already exists
		try {
			await vscode.workspace.fs.stat(bobDir);
			
			// Directory exists, ask user
			const choice = await vscode.window.showWarningMessage(
				'TruthLens artifacts already exist in .bob/. Overwrite?',
				'Yes',
				'No',
				'Show Diff'
			);
			
			if (choice === 'No') {
				log('User chose not to overwrite existing artifacts');
				return;
			}
			
			if (choice === 'Show Diff') {
				vscode.window.showInformationMessage('Diff view not yet implemented. Skipping overwrite.');
				return;
			}
		} catch {
			// Directory doesn't exist, proceed with creation
			log('.bob directory does not exist, creating...');
		}

		// Create directory structure
		await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(bobDir, 'modes'));
		await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(bobDir, 'skills'));
		await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(bobDir, 'commands'));
		
		// Get bundled artifacts from extension
		const extensionPath = context.extensionUri;
		const artifactsPath = vscode.Uri.joinPath(extensionPath, 'bob_artifacts');
		
		// Copy all artifacts
		const artifactFiles = [
			{ src: 'custom_modes.yaml', dest: 'custom_modes.yaml' },
			{ src: 'modes/auditor.md', dest: 'modes/auditor.md' },
			{ src: 'skills/claim-taxonomy.md', dest: 'skills/claim-taxonomy.md' },
			{ src: 'skills/claim-verification.md', dest: 'skills/claim-verification.md' },
			{ src: 'commands/audit.md', dest: 'commands/audit.md' },
			{ src: 'commands/fix-claim.md', dest: 'commands/fix-claim.md' },
			{ src: 'commands/fix-all.md', dest: 'commands/fix-all.md' }
		];

		for (const file of artifactFiles) {
			const srcUri = vscode.Uri.joinPath(artifactsPath, file.src);
			const destUri = vscode.Uri.joinPath(bobDir, file.dest);
			
			try {
				const content = await vscode.workspace.fs.readFile(srcUri);
				await vscode.workspace.fs.writeFile(destUri, content);
				log(`Copied ${file.src} to .bob/${file.dest}`);
			} catch (error) {
				log(`Warning: Could not copy ${file.src}: ${error}`);
			}
		}

		log('Bob artifacts scaffolded successfully');
	} catch (error) {
		throw new Error(`Failed to scaffold Bob artifacts: ${error}`);
	}
}

function setupFileWatcher(context: vscode.ExtensionContext, workspaceFolder: vscode.WorkspaceFolder): void {
	const findingsPattern = new vscode.RelativePattern(workspaceFolder, '.truthlens/findings.json');
	fileWatcher = vscode.workspace.createFileSystemWatcher(findingsPattern);

	// Watch for changes
	fileWatcher.onDidChange(async () => {
		log('Findings file changed, refreshing UI');
		await refreshUI();
	});

	fileWatcher.onDidCreate(async () => {
		log('Findings file created, refreshing UI');
		await refreshUI();
	});

	fileWatcher.onDidDelete(async () => {
		log('Findings file deleted, refreshing UI');
		await refreshUI();
	});

	context.subscriptions.push(fileWatcher);
}

async function refreshUI(): Promise<void> {
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	log(`refreshUI: workspace root is ${workspaceRoot || 'undefined'}`);
	await findingsProvider.refresh();
	const findings = findingsProvider.getFindings();
	log(`refreshUI: findings ${findings ? `loaded (${findings.summary.total} total)` : 'not found'}`);
	statusBarManager.update(findings);
	if (codeLensProvider) {
		codeLensProvider.updateFindings(findings);
	}
	if (decorationProvider) {
		decorationProvider.updateFindings(findings);
	}
	DashboardPanel.update(findings);
}

function registerCommands(context: vscode.ExtensionContext) {
	// Audit command
	context.subscriptions.push(
		vscode.commands.registerCommand('truthlens.audit', async () => {
			try {
				log('Audit command triggered');
				const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
				if (!workspaceFolder) {
					vscode.window.showErrorMessage('TruthLens: No workspace folder open. Please open a folder to audit.');
					return;
				}
				outputChannel.show(true);
				await runAudit(log);
			} catch (error) {
				handleError('Audit failed', error);
			}
		})
	);

	// Scaffold command (manual re-trigger)
	context.subscriptions.push(
		vscode.commands.registerCommand('truthlens.scaffold', async () => {
			try {
				log('Manual scaffold command triggered');
				const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
				if (!workspaceFolder) {
					vscode.window.showErrorMessage('No workspace folder open');
					return;
				}
				await scaffoldBobArtifacts(context, workspaceFolder);
				vscode.window.showInformationMessage('TruthLens artifacts scaffolded successfully');
			} catch (error) {
				handleError('Scaffold command failed', error);
			}
		})
	);

	// Fix command — triggers Bob with the appropriate /fix-claim prompt after confirmation
	context.subscriptions.push(
		vscode.commands.registerCommand('truthlens.fix', async (findingId?: string, strategy?: string) => {
			try {
				log(`Fix command triggered for finding: ${findingId || 'none'}, strategy: ${strategy || 'auto'}`);
				const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
				if (!workspaceFolder) {
					vscode.window.showErrorMessage('TruthLens: No workspace folder open.');
					return;
				}
				if (!findingId) {
					vscode.window.showErrorMessage('TruthLens: No finding ID provided.');
					return;
				}
				const report = findingsProvider.getFindings();
				const finding = report?.findings.find(f => f.id === findingId);
				if (!finding) {
					vscode.window.showErrorMessage(`TruthLens: Finding ${findingId} not found. Run an audit first.`);
					return;
				}
				if (finding.status === 'resolved') {
					vscode.window.showInformationMessage(`TruthLens: Finding ${findingId} is already resolved.`);
					return;
				}
				outputChannel.show(true);
				await runFix(finding, strategy, log);
			} catch (error) {
				handleError('Fix command failed', error);
			}
		})
	);

	// Fix all open findings — single /fix-all prompt to Bob (batch)
	context.subscriptions.push(
		vscode.commands.registerCommand('truthlens.fixAll', async () => {
			try {
				log('Fix-all command triggered');
				const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
				if (!workspaceFolder) {
					vscode.window.showErrorMessage('TruthLens: No workspace folder open.');
					return;
				}
				const report = findingsProvider.getFindings();
				const open = report?.findings.filter(f => f.status === 'open') ?? [];
				if (open.length === 0) {
					vscode.window.showInformationMessage('TruthLens: No open findings. Run an audit first or refresh findings.');
					return;
				}
				outputChannel.show(true);
				await runFixAll(open, log);
			} catch (error) {
				handleError('Fix all failed', error);
			}
		})
	);

	// Mark resolved command — updates findings.json directly without invoking Bob
	context.subscriptions.push(
		vscode.commands.registerCommand('truthlens.markResolved', async (findingId?: string) => {
			try {
				log(`Mark resolved command triggered for: ${findingId || 'none'}`);
				const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
				if (!workspaceFolder) {
					vscode.window.showErrorMessage('TruthLens: No workspace folder open.');
					return;
				}
				if (!findingId) {
					// Prompt user to enter an ID if not provided (e.g. from command palette)
					findingId = await vscode.window.showInputBox({
						prompt: 'Enter the finding ID to mark as resolved (e.g. F-001)',
						placeHolder: 'F-001',
						validateInput: v => v?.trim() ? undefined : 'Finding ID is required'
					});
					if (!findingId) { return; }
				}
				const resolved = await markFindingResolved(findingId.trim(), workspaceFolder, log);
				if (resolved) {
					await refreshUI();
					vscode.window.showInformationMessage(`TruthLens: ${findingId} marked as resolved.`);
				}
			} catch (error) {
				handleError('Mark resolved command failed', error);
			}
		})
	);

	// Dismiss finding command — marks a finding as dismissed (false positive / won't fix)
	context.subscriptions.push(
		vscode.commands.registerCommand('truthlens.dismissFinding', async (findingId?: string) => {
			try {
				log(`Dismiss finding command triggered for: ${findingId || 'none'}`);
				const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
				if (!workspaceFolder) {
					vscode.window.showErrorMessage('TruthLens: No workspace folder open.');
					return;
				}
				if (!findingId) {
					findingId = await vscode.window.showInputBox({
						prompt: 'Enter the finding ID to dismiss (e.g. F-001)',
						placeHolder: 'F-001',
						validateInput: v => v?.trim() ? undefined : 'Finding ID is required'
					});
					if (!findingId) { return; }
				}
				const dismissed = await dismissFinding(findingId.trim(), workspaceFolder, log);
				if (dismissed) {
					await refreshUI();
					vscode.window.showInformationMessage(`TruthLens: ${findingId} dismissed.`);
				}
			} catch (error) {
				handleError('Dismiss finding command failed', error);
			}
		})
	);

	// Open dashboard command
	context.subscriptions.push(
		vscode.commands.registerCommand('truthlens.openDashboard', async () => {
			try {
				log('Open dashboard command triggered');
				const findings = findingsProvider.getFindings();
				DashboardPanel.show(findings, context.extensionUri);
			} catch (error) {
				handleError('Open dashboard command failed', error);
			}
		})
	);

	// Refresh findings command
	context.subscriptions.push(
		vscode.commands.registerCommand('truthlens.refreshFindings', async () => {
			try {
				log('Refresh findings command triggered');
				await refreshUI();
				vscode.window.showInformationMessage('TruthLens: Findings refreshed');
			} catch (error) {
				handleError('Refresh findings command failed', error);
			}
		})
	);

	// Show finding detail command (from CodeLens or hover)
	context.subscriptions.push(
		vscode.commands.registerCommand('truthlens.showFindingDetail', async (finding: Finding) => {
			try {
				log(`Showing detail for finding ${finding.id}`);
				FindingDetailPanel.show(finding, context.extensionUri);
			} catch (error) {
				handleError('Show finding detail failed', error);
			}
		})
	);

	// Open finding command (for click-to-jump from tree view)
	context.subscriptions.push(
		vscode.commands.registerCommand('truthlens.openFinding', async (finding: Finding) => {
			try {
				log(`Opening finding ${finding.id} at ${finding.file}:${finding.line}`);
				
				const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
				if (!workspaceFolder) {
					vscode.window.showErrorMessage('No workspace folder open');
					return;
				}

				// Construct file URI
				const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, finding.file);
				
				// Open the document
				const document = await vscode.workspace.openTextDocument(fileUri);
				const editor = await vscode.window.showTextDocument(document);
				
				// Jump to the line
				const line = finding.line - 1; // Convert to 0-indexed
				const position = new vscode.Position(line, 0);
				editor.selection = new vscode.Selection(position, position);
				editor.revealRange(
					new vscode.Range(position, position),
					vscode.TextEditorRevealType.InCenter
				);
			} catch (error) {
				handleError('Open finding command failed', error);
			}
		})
	);

	log('All commands registered');
}

/**
 * Log message to output channel
 */
function log(message: string) {
	const timestamp = new Date().toISOString();
	outputChannel.appendLine(`[${timestamp}] ${message}`);
}

function handleError(context: string, error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	const stack = error instanceof Error ? error.stack : '';
	
	log(`ERROR [${context}]: ${message}`);
	if (stack) {
		log(`Stack trace: ${stack}`);
	}
	
	vscode.window.showErrorMessage(
		`TruthLens: ${context}`,
		'View Logs'
	).then(action => {
		if (action === 'View Logs') {
			outputChannel.show();
		}
	});
}

export function deactivate() {
	log('TruthLens extension deactivating...');
	outputChannel.dispose();
}
