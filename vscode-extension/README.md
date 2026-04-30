# ObsiCapture

**A VS Code extension that auto-generates project documentation with Claude AI and saves it directly to Obsidian.**

---

## Features

- **AI document generation** — Claude AI analyzes your project code and writes Markdown documentation in real time
- **Direct Obsidian save** — saves the generated document straight to any folder in your Obsidian Vault
- **Sidebar integration** — accessible directly from the VS Code Activity Bar
- **Streaming output** — watch the document being written as it generates
- **Claude CLI mode** _(v0.2.0+)_ — use a locally installed Claude Code CLI without an API key

---

## Screenshots

<!-- 📸 캡쳐 ①: VS Code 활동 바에서 ObsiCapture 사이드바가 열린 메인 화면 (입력창 + Generate 버튼 + Vault/폴더 선택 UI 포함) -->

![ObsiCapture sidebar](https://raw.githubusercontent.com/ktmihs/Obsicapture/main/vscode-extension/images/screenshot-sidebar.png)

<!-- 📸 캡쳐 ②: Claude AI가 마크다운 문서를 실시간 스트리밍으로 작성 중인 화면 (생성 진행 중 상태) -->

![Streaming document generation](https://raw.githubusercontent.com/ktmihs/Obsicapture/main/vscode-extension/images/screenshot-generating.png)

<!-- 📸 캡쳐 ③: 생성 완료 후 파일명/저장 폴더를 선택하고 Save to Obsidian 버튼이 보이는 화면 -->

![Save to Obsidian](https://raw.githubusercontent.com/ktmihs/Obsicapture/main/vscode-extension/images/screenshot-save.png)

<!-- 📸 캡쳐 ④: VS Code 설정 화면에서 ObsiCapture 항목을 검색한 결과 (claudeMode, claudeApiKey, vaultPath, maxChars 등이 보이는 상태) -->

![Extension settings](https://raw.githubusercontent.com/ktmihs/Obsicapture/main/vscode-extension/images/screenshot-settings.png)

---

## Getting Started

### 1. Get a Claude API Key

Obtain an API key from [console.anthropic.com](https://console.anthropic.com).

### 2. Configure the Extension

Open `Ctrl+,`, search for **ObsiCapture**, and fill in the following:

| Setting                     | Description                                                             |
| --------------------------- | ----------------------------------------------------------------------- |
| `obsicapture.claudeApiKey`  | Your Anthropic Claude API key                                           |
| `obsicapture.vaultPath`     | Absolute path to your Obsidian Vault (e.g. `C:/Users/yourname/MyVault`) |
| `obsicapture.defaultFolder` | Default save folder (leave blank for Vault root)                        |
| `obsicapture.maxFiles`      | Max files to read at once (default: 50)                                 |
| `obsicapture.model`         | Claude model to use                                                     |

### 3. Usage

1. Click the **ObsiCapture icon** in the left Activity Bar
2. Enter the type of document you want (e.g. "API reference", "README", "architecture doc")
3. Click **Generate** — Claude AI will analyze your project and write the document
4. Confirm the filename and folder, then click **Save to Obsidian**

---

## Supported Models

| Model               | Notes                                        |
| ------------------- | -------------------------------------------- |
| `claude-sonnet-4-6` | Default. Best balance of speed and quality   |
| `claude-opus-4-7`   | Highest quality, ideal for complex documents |
| `claude-haiku-4-5`  | Fastest, suitable for simple documents       |

---

## Requirements

- VS Code 1.85.0 or later
- Anthropic Claude API key
- Obsidian (required when saving documents)

---

## Issues & Feedback

[GitHub Issues](https://github.com/ktmihs/Obsicapture/issues)
