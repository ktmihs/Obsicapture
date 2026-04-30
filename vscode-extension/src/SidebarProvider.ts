import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { readProjectFiles, formatFilesForPrompt } from './CodeReader';
import {
	generateDocument,
	extractTitle,
	getCliStatus,
	CliStatus,
} from './ClaudeClient';
import {
	saveToObsidian,
	listVaultFolders,
	createVaultFolder,
} from './ObsidianWriter';

type Message =
	| { type: 'READY' }
	| { type: 'GENERATE'; prompt: string }
	| { type: 'SAVE'; fileName: string; folder: string }
	| { type: 'CREATE_FOLDER'; folderPath: string }
	| { type: 'OPEN_SETTINGS' };

export class SidebarProvider implements vscode.WebviewViewProvider {
	static readonly viewType = 'obsicapture.sidebarView';
	private view?: vscode.WebviewView;
	private generatedContent = '';

	constructor(private readonly context: vscode.ExtensionContext) {}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this.view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		};
		webviewView.webview.html = this.getHtml();
		webviewView.webview.onDidReceiveMessage((msg: Message) =>
			this.handleMessage(msg),
		);
	}

	private async handleMessage(msg: Message) {
		const config = vscode.workspace.getConfiguration('obsicapture');

		switch (msg.type) {
			case 'READY': {
				try {
					const mode = config.get<'api' | 'cli'>('claudeMode', 'api');
					const folders = await (async () => {
						const vaultPath = config.get<string>('vaultPath', '');
						return vaultPath
							? await listVaultFolders(vaultPath)
							: ['(vault 루트)'];
					})();
					const defaultFolder = config.get<string>('defaultFolder', '');
					const workspaceName = vscode.workspace.workspaceFolders?.[0]
						? path.basename(vscode.workspace.workspaceFolders[0].uri.fsPath)
						: '(워크스페이스 없음)';

					let cliStatus: CliStatus | undefined;
					if (mode === 'cli') {
						cliStatus = await getCliStatus();
					}

					this.post({
						type: 'READY_ACK',
						workspaceName,
						folders,
						defaultFolder,
						mode,
						cliAvailable: cliStatus?.available,
						cliUser: cliStatus?.user,
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

			case 'CREATE_FOLDER': {
				const vaultPath = config.get<string>('vaultPath', '');
				if (!vaultPath) {
					this.post({
						type: 'ERROR',
						message: 'Vault 경로가 설정되지 않았습니다.',
					});
					return;
				}
				try {
					await createVaultFolder(vaultPath, msg.folderPath);
					const folders = await listVaultFolders(vaultPath);
					this.post({
						type: 'FOLDER_CREATED',
						folders,
						newFolder: msg.folderPath,
					});
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
		this.view?.webview.postMessage(data);
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
