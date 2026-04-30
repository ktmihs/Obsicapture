import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { readProjectFiles, formatFilesForPrompt } from './CodeReader';
import { generateDocument, extractTitle } from './ClaudeClient';
import { saveToObsidian, listVaultFolders } from './ObsidianWriter';

type Message =
	| { type: 'READY' }
	| { type: 'GENERATE'; prompt: string }
	| { type: 'SAVE'; fileName: string; folder: string }
	| { type: 'OPEN_SETTINGS' };

export class DocPanel {
	static currentPanel: DocPanel | undefined;
	private readonly panel: vscode.WebviewPanel;
	private readonly context: vscode.ExtensionContext;
	private generatedContent = '';
	private disposables: vscode.Disposable[] = [];

	static createOrShow(context: vscode.ExtensionContext) {
		if (DocPanel.currentPanel) {
			DocPanel.currentPanel.panel.reveal();
			return;
		}
		const panel = vscode.window.createWebviewPanel(
			'obsicapture',
			'ObsiCapture',
			vscode.ViewColumn.Beside,
			{ enableScripts: true, retainContextWhenHidden: true },
		);
		DocPanel.currentPanel = new DocPanel(panel, context);
	}

	private constructor(
		panel: vscode.WebviewPanel,
		context: vscode.ExtensionContext,
	) {
		this.panel = panel;
		this.context = context;
		this.panel.webview.html = this.getHtml();
		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
		this.panel.webview.onDidReceiveMessage(
			(msg: Message) => this.handleMessage(msg),
			null,
			this.disposables,
		);
	}

	private async handleMessage(msg: Message) {
		const config = vscode.workspace.getConfiguration('obsicapture');

		switch (msg.type) {
			case 'READY': {
				try {
					const folders = await (async () => {
						const vaultPath = config.get<string>('vaultPath', '');
						return vaultPath
							? await listVaultFolders(vaultPath)
							: ['(vault 루트)'];
					})();
					const defaultFolder = config.get<string>('defaultFolder', '');
					const maxChars = config.get<number>('maxChars', 0);
					const workspaceName = vscode.workspace.workspaceFolders?.[0]
						? path.basename(vscode.workspace.workspaceFolders[0].uri.fsPath)
						: '(워크스페이스 없음)';
					this.post({
						type: 'READY_ACK',
						workspaceName,
						folders,
						defaultFolder,
						maxChars,
					});
				} catch (e) {
					this.post({ type: 'ERROR', message: String(e) });
				}
				break;
			}

			case 'GENERATE': {
				const mode = config.get<'api' | 'cli'>('claudeMode', 'api');
				const apiKey = config.get<string>('claudeApiKey', '');
				const model = config.get<string>('model', 'claude-sonnet-4-6');
				const maxFiles = config.get<number>('maxFiles', 50);

				if (mode === 'api' && !apiKey) {
					this.post({
						type: 'ERROR',
						message:
							'API 모드에서는 Claude API 키가 필요합니다. 설정에서 입력해주세요.',
					});
					return;
				}

				this.generatedContent = '';
				this.post({ type: 'STREAM_START' });

				try {
					const ctx = await readProjectFiles(maxFiles);
					const codeContext = formatFilesForPrompt(ctx);

					await generateDocument({
						mode,
						apiKey,
						model,
						codeContext,
						userPrompt: msg.prompt,
						onChunk: text => {
							this.generatedContent += text;
							this.post({ type: 'STREAM_CHUNK', text });
						},
						onDone: () => {
							const title = extractTitle(this.generatedContent);
							this.post({ type: 'STREAM_DONE', suggestedFileName: title });
						},
						onError: error => {
							this.post({ type: 'ERROR', message: error });
						},
					});
				} catch (e) {
					this.post({ type: 'ERROR', message: String(e) });
				}
				break;
			}

			case 'SAVE': {
				const vaultPath = config.get<string>('vaultPath', '');
				if (!vaultPath) {
					this.post({
						type: 'ERROR',
						message: 'Vault 경로가 설정되지 않았습니다.',
					});
					return;
				}
				try {
					const folder = msg.folder === '(vault 루트)' ? '' : msg.folder;
					const savedPath = await saveToObsidian(
						vaultPath,
						folder,
						msg.fileName,
						this.generatedContent,
					);
					this.post({ type: 'SAVE_DONE', path: savedPath });
				} catch (e) {
					this.post({ type: 'ERROR', message: String(e) });
				}
				break;
			}

			case 'OPEN_SETTINGS':
				vscode.commands.executeCommand(
					'workbench.action.openSettings',
					'obsicapture',
				);
				break;
		}
	}

	private post(data: object) {
		this.panel.webview.postMessage(data);
	}

	private dispose() {
		DocPanel.currentPanel = undefined;
		this.panel.dispose();
		this.disposables.forEach(d => d.dispose());
	}

	private getHtml(): string {
		const nonce = require('crypto').randomBytes(16).toString('hex');
		const htmlPath = path.join(
			this.context.extensionPath,
			'media',
			'panel.html',
		);
		return fs.readFileSync(htmlPath, 'utf-8').replace(/{{NONCE}}/g, nonce);
	}
}
