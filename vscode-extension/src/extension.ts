import * as vscode from 'vscode';
import { DocPanel } from './DocPanel';
import { SidebarProvider } from './SidebarProvider';

export function activate(context: vscode.ExtensionContext) {
	const sidebarProvider = new SidebarProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			SidebarProvider.viewType,
			sidebarProvider,
		),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('obsicapture.openPanel', () => {
			const config = vscode.workspace.getConfiguration('obsicapture');
			const apiKey = config.get<string>('claudeApiKey', '');

			if (!apiKey) {
				vscode.window
					.showErrorMessage(
						'ObsiCapture: Claude API 키가 설정되지 않았습니다.',
						'설정 열기',
					)
					.then(action => {
						if (action === '설정 열기') {
							vscode.commands.executeCommand(
								'workbench.action.openSettings',
								'obsicapture',
							);
						}
					});
				return;
			}

			DocPanel.createOrShow(context);
		}),
	);
}

export function deactivate() {}
