# VSCode 확장 프로그램 — ObsiCapture for VSCode 기획

## 개요

VSCode에서 현재 열려 있는 프로젝트 코드를 분석해,  
사용자가 원하는 문서(README, API 레퍼런스, 설계 문서 등)를 Claude API로 생성하고  
Obsidian Vault에 자동 저장하는 확장 프로그램.

---

## 사용 흐름

```
1. VSCode 사이드바 또는 커맨드 팔레트에서 ObsiCapture 패널 열기
2. 입력창에 원하는 문서 설명 입력
   예: "이 프로젝트의 API 엔드포인트 레퍼런스 문서 만들어줘"
        "주요 함수들 정리해서 개발자 온보딩 문서 작성해줘"
3. 확장이 현재 프로젝트 파일을 읽고 Claude API에 전달
4. 생성된 문서를 패널에서 미리보기
5. 파일명/저장 폴더 확인 후 Obsidian에 저장
```

---

## 필요한 것들

### 1. VSCode Extension 구성요소

| 항목 | 설명 |
|------|------|
| `extension.ts` | 진입점. 커맨드 등록, 패널 열기 |
| `DocPanel.ts` | WebviewPanel 관리 (UI ↔ 익스텐션 메시지 통신) |
| `CodeReader.ts` | 프로젝트 파일 읽기, 구조 파악 |
| `ClaudeClient.ts` | Claude API 호출 (스트리밍 지원) |
| `ObsidianWriter.ts` | Obsidian Vault에 파일 저장 |
| `webview/` | 패널 UI (HTML + CSS + JS) |

### 2. VSCode API

- `vscode.window.createWebviewPanel` — 입력/미리보기 패널
- `vscode.workspace.findFiles` — 프로젝트 파일 탐색
- `vscode.workspace.fs.readFile` — 파일 내용 읽기
- `vscode.workspace.getConfiguration` — 설정값 읽기
- `vscode.commands.registerCommand` — 커맨드 등록

### 3. 설정 항목 (`settings.json`)

```json
{
  "obsicapture.claudeApiKey": "",
  "obsicapture.vaultPath": "/Users/.../MyVault",
  "obsicapture.defaultFolder": "개발 문서",
  "obsicapture.maxFilesToRead": 30
}
```

### 4. Claude API

- 모델: `claude-opus-4-7` 또는 `claude-sonnet-4-6`
- 스트리밍 응답 (`stream: true`) — 긴 문서는 실시간으로 패널에 표시
- 프로젝트 파일을 컨텍스트로 전달 (파일 수 / 토큰 제한 고려)

### 5. Obsidian 연동

- Chrome 확장과 달리 **File System API 제한 없음** — Node.js `fs`로 직접 쓰기
- 설정에서 Vault 절대 경로 지정
- 저장 시 중복 파일명 처리 (기존과 동일하게 `(1)`, `(2)` 처리)

---

## 파일 구조

```
vscode-obsicapture/
├── src/
│   ├── extension.ts          # 진입점
│   ├── DocPanel.ts           # Webview 패널
│   ├── CodeReader.ts         # 파일 읽기 + 구조 파악
│   ├── ClaudeClient.ts       # API 클라이언트
│   └── ObsidianWriter.ts     # Vault 저장
├── webview/
│   ├── index.html            # 패널 UI
│   ├── style.css
│   └── main.js               # 패널 ↔ extension 통신
├── package.json              # VSCode extension manifest
└── tsconfig.json
```

---

## 패널 UI 구성

```
┌─────────────────────────────────┐
│  📎 ObsiCapture                 │
├─────────────────────────────────┤
│  현재 프로젝트: my-project      │
│  파일 23개 감지됨               │
├─────────────────────────────────┤
│  어떤 문서를 만들까요?          │
│  ┌───────────────────────────┐  │
│  │ API 레퍼런스 문서 만들어줘│  │
│  └───────────────────────────┘  │
│                                 │
│  포함할 파일 (선택)             │
│  ☑ src/  ☑ README  ☐ tests/    │
│                                 │
│  [생성하기]                     │
├─────────────────────────────────┤
│  미리보기 (스트리밍)            │
│  # API 레퍼런스                 │
│  ...                            │
├─────────────────────────────────┤
│  📁 저장 폴더  [개발 문서    ▼] │
│  📄 파일명     [API-Reference  ]│
│  [Obsidian에 저장]              │
└─────────────────────────────────┘
```

---

## 구현 단계

### Phase 1 — 기본 동작
- [ ] VSCode 확장 프로젝트 초기화 (`yo code`)
- [ ] Webview 패널 열기 / 닫기
- [ ] 설정 페이지 (API 키, Vault 경로)
- [ ] 프로젝트 파일 목록 읽기
- [ ] Claude API 기본 호출 → 패널에 결과 표시
- [ ] Obsidian 저장

### Phase 2 — 품질 개선
- [ ] 스트리밍 응답 (생성 중 실시간 표시)
- [ ] 포함할 파일 체크박스 선택
- [ ] 파일 수 / 토큰 자동 제한 (`.gitignore` 존중)
- [ ] 마크다운 미리보기 렌더링

### Phase 3 — 고급 기능
- [ ] 문서 템플릿 프리셋 (README / API 레퍼런스 / 온보딩 / 변경 이력)
- [ ] 기존 Obsidian 노트 업데이트 (덮어쓰기 옵션)
- [ ] Obsidian 역방향 링크 자동 삽입 (기존 ObsiCapture 로직 재사용)

---

## 기술 스택

| 항목 | 선택 |
|------|------|
| 언어 | TypeScript |
| 번들러 | esbuild |
| 패널 UI | Vanilla JS + CSS (프레임워크 불필요) |
| API | Anthropic SDK (`@anthropic-ai/sdk`) |
| 파일 저장 | Node.js `fs/promises` |
| 배포 | VSCode Marketplace (`vsce`) |

---

## Chrome 확장과의 차이점

| 항목 | Chrome 확장 | VSCode 확장 |
|------|-------------|-------------|
| 데이터 소스 | 웹 페이지 대화 | 프로젝트 코드 |
| Obsidian 저장 | File System Access API (브라우저 제한) | Node.js fs (제한 없음) |
| 입력 | 버튼 클릭 | 텍스트 입력창 |
| 출력 | AI 요약 또는 원문 | AI 생성 문서 |
