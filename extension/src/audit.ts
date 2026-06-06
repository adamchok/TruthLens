import * as vscode from 'vscode';

const BOB_OPEN_COMMAND = 'bob-code.SidebarProvider.focus';

export async function runAudit(log: (message: string) => void): Promise<void> {
	log('[audit] Starting — Bob chat integration');
	try {
		await invokeBobChatWithPrompt('/audit', log);
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		log(`[audit] ERROR: ${msg}`);
		throw error;
	}
}

export async function invokeBobChatWithPrompt(
	prompt: string,
	log: (msg: string) => void,
	infoTitle?: string,
	infoDetail?: string
): Promise<void> {
	try {
		await vscode.commands.executeCommand(BOB_OPEN_COMMAND);
		log('[chat] Opened Bob chat');
	} catch {
		log('[chat] Could not auto-open Bob chat; user must open it manually');
	}

	await vscode.env.clipboard.writeText(prompt);
	log(`[chat] Copied "${prompt}" to clipboard`);

	const defaultTitle = `Bob chat is open. Paste (Ctrl+V) and press Enter to run: ${prompt}. TruthLens will update automatically when findings arrive.`;

	const action = await vscode.window.showInformationMessage(
		infoTitle ?? defaultTitle,
		{ detail: infoDetail },
		'Got it',
		'Open Bob Chat'
	);

	if (action === 'Open Bob Chat') {
		try { await vscode.commands.executeCommand(BOB_OPEN_COMMAND); } catch { /* ignore */ }
	}

	log('[chat] User acknowledged instructions');
}
