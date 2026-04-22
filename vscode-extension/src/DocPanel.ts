import * as vscode from 'vscode';
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
				const maxFiles = config.get<number>('maxFiles', 50);
				try {
					const ctx = await readProjectFiles(maxFiles);
					const vaultPath = config.get<string>('vaultPath', '');
					const folders = vaultPath
						? await listVaultFolders(vaultPath)
						: ['(vault 루트)'];
					const defaultFolder = config.get<string>('defaultFolder', '');
					this.post({
						type: 'PROJECT_INFO',
						name: ctx.name,
						fileCount: ctx.files.length,
						tokens: ctx.estimatedTokens,
						folders,
						defaultFolder,
					});
				} catch (e) {
					this.post({ type: 'ERROR', message: String(e) });
				}
				break;
			}

			case 'GENERATE': {
				const apiKey = config.get<string>('claudeApiKey', '');
				const model = config.get<string>('model', 'claude-sonnet-4-6');
				const maxFiles = config.get<number>('maxFiles', 50);

				this.generatedContent = '';
				this.post({ type: 'STREAM_START' });

				try {
					const ctx = await readProjectFiles(maxFiles);
					const codeContext = formatFilesForPrompt(ctx);

					await generateDocument({
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
		return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .header {
      padding: 14px 20px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .header-logo { font-size: 18px; }
    .header-title { font-size: 14px; font-weight: 700; color: #c8b5f5; }
    .header-meta { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 1px; }

    .body {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 16px 20px;
      gap: 12px;
    }

    .project-info {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-input-background);
      border-radius: 6px;
      padding: 8px 12px;
      display: none;
    }
    .project-info.visible { display: block; }
    .project-info strong { color: #c8b5f5; }

    .prompt-label { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 4px; }

    textarea {
      width: 100%;
      padding: 10px 12px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 6px;
      color: var(--vscode-input-foreground);
      font-family: var(--vscode-font-family);
      font-size: 13px;
      resize: none;
      outline: none;
      min-height: 80px;
    }
    textarea:focus { border-color: #7c4dff; }

    .generate-btn {
      width: 100%;
      padding: 10px;
      background: linear-gradient(135deg, #7c4dff, #5c35cc);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .generate-btn:hover { opacity: 0.88; }
    .generate-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .preview-wrap {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      display: none;
    }
    .preview-wrap.visible { display: flex; }
    .preview-label { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 4px; }
    .preview {
      flex: 1;
      overflow-y: auto;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 6px;
      padding: 12px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .save-area {
      display: none;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
    }
    .save-area.visible { display: flex; }

    .row { display: flex; gap: 8px; }

    select, input[type="text"] {
      flex: 1;
      padding: 7px 10px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 6px;
      color: var(--vscode-input-foreground);
      font-family: var(--vscode-font-family);
      font-size: 12px;
      outline: none;
    }
    select:focus, input[type="text"]:focus { border-color: #7c4dff; }

    .save-btn {
      padding: 9px 16px;
      background: linear-gradient(135deg, #2e7d52, #1a5c3a);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: opacity 0.2s;
    }
    .save-btn:hover { opacity: 0.88; }
    .save-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .status {
      font-size: 11px;
      padding: 8px 12px;
      border-radius: 6px;
      display: none;
    }
    .status.loading { display: block; background: rgba(123,179,240,0.1); color: #7bb3f0; }
    .status.success { display: block; background: rgba(126,200,160,0.1); color: #7ec8a0; }
    .status.error   { display: block; background: rgba(240,123,123,0.1); color: #f07b7b; }

    .footer {
      padding: 8px 20px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      justify-content: flex-end;
      flex-shrink: 0;
    }
    .settings-link {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      background: none;
      border: none;
    }
    .settings-link:hover { color: #c8b5f5; }

    .cursor::after { content: '\\258B'; animation: blink 0.8s step-end infinite; }
    @keyframes blink { 50% { opacity: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <span class="header-logo">&#x1F4CE;</span>
    <div>
      <div class="header-title">ObsiCapture</div>
      <div class="header-meta" id="header-meta">프로젝트 분석 중...</div>
    </div>
  </div>

  <div class="body">
    <div class="project-info" id="project-info"></div>

    <div>
      <div class="prompt-label">어떤 문서를 만들까요?</div>
      <textarea id="prompt" placeholder="예: 이 프로젝트의 API 레퍼런스 문서 작성해줘&#10;예: 주요 컴포넌트 구조와 props 정리해줘&#10;예: 신규 개발자 온보딩 가이드 만들어줘"></textarea>
    </div>

    <button class="generate-btn" id="generate-btn" disabled>&#x2728; 문서 생성</button>

    <div class="preview-wrap" id="preview-wrap">
      <div class="preview-label">미리보기</div>
      <div class="preview" id="preview"></div>
    </div>

    <div class="status" id="status"></div>

    <div class="save-area" id="save-area">
      <div class="row">
        <select id="folder-select"></select>
        <input type="text" id="filename-input" placeholder="파일명" />
      </div>
      <button class="save-btn" id="save-btn">&#x1F4BE; Obsidian에 저장</button>
    </div>
  </div>

  <div class="footer">
    <button class="settings-link" id="settings-link">&#x2699; 설정</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    const els = {
      meta:       document.getElementById('header-meta'),
      info:       document.getElementById('project-info'),
      prompt:     document.getElementById('prompt'),
      generateBtn:document.getElementById('generate-btn'),
      previewWrap:document.getElementById('preview-wrap'),
      preview:    document.getElementById('preview'),
      status:     document.getElementById('status'),
      saveArea:   document.getElementById('save-area'),
      folderSel:  document.getElementById('folder-select'),
      fileInput:  document.getElementById('filename-input'),
      saveBtn:    document.getElementById('save-btn'),
      settingsLink:document.getElementById('settings-link'),
    };

    // 단축키: Ctrl+Enter로 생성
    els.prompt.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') els.generateBtn.click();
    });

    els.generateBtn.addEventListener('click', () => {
      const prompt = els.prompt.value.trim();
      if (!prompt) return;
      vscode.postMessage({ type: 'GENERATE', prompt });
    });

    els.saveBtn.addEventListener('click', () => {
      vscode.postMessage({
        type: 'SAVE',
        fileName: els.fileInput.value.trim() || 'untitled',
        folder: els.folderSel.value,
      });
    });

    els.settingsLink.addEventListener('click', () => {
      vscode.postMessage({ type: 'OPEN_SETTINGS' });
    });

    window.addEventListener('message', ({ data }) => {
      switch (data.type) {
        case 'PROJECT_INFO': {
          els.meta.textContent = data.name + ' · ' + data.fileCount + '개 파일';
          els.info.innerHTML =
            '<strong>' + data.name + '</strong> &nbsp;|&nbsp; ' +
            '파일 ' + data.fileCount + '개 &nbsp;|&nbsp; ' +
            '예상 토큰 ~' + data.tokens.toLocaleString();
          els.info.classList.add('visible');
          els.generateBtn.disabled = false;

          els.folderSel.innerHTML = data.folders
            .map(f => '<option value="' + f + '"' + (f === data.defaultFolder ? ' selected' : '') + '>' + f + '</option>')
            .join('');
          break;
        }

        case 'STREAM_START':
          els.previewWrap.classList.add('visible');
          els.preview.textContent = '';
          els.preview.classList.add('cursor');
          els.saveArea.classList.remove('visible');
          els.generateBtn.disabled = true;
          setStatus('loading', '문서 생성 중...');
          break;

        case 'STREAM_CHUNK':
          els.preview.textContent += data.text;
          els.preview.scrollTop = els.preview.scrollHeight;
          break;

        case 'STREAM_DONE':
          els.preview.classList.remove('cursor');
          els.generateBtn.disabled = false;
          els.fileInput.value = data.suggestedFileName;
          els.saveArea.classList.add('visible');
          setStatus('success', '생성 완료! 파일명 확인 후 저장하세요.');
          break;

        case 'SAVE_DONE':
          setStatus('success', '저장 완료!\n' + data.path);
          els.saveBtn.disabled = false;
          break;

        case 'ERROR':
          els.preview.classList.remove('cursor');
          els.generateBtn.disabled = false;
          els.saveBtn.disabled = false;
          setStatus('error', '[오류] ' + data.message);
          break;
      }
    });

    function setStatus(type, msg) {
      els.status.className = 'status ' + type;
      els.status.textContent = msg;
    }

    vscode.postMessage({ type: 'READY' });
  </script>
</body>
</html>`;
	}
}
