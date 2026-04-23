# ObsiCapture

**Claude AI로 프로젝트 문서를 자동 생성하고 Obsidian에 바로 저장하는 VS Code 확장프로그램**

---

## 주요 기능

- **AI 문서 자동 생성** — 현재 프로젝트의 코드를 분석해 Claude AI가 마크다운 문서를 실시간으로 작성
- **Obsidian 직접 저장** — 생성된 문서를 Obsidian Vault의 원하는 폴더에 바로 저장
- **사이드바 통합** — VS Code 활동 바에서 바로 접근 가능
- **스트리밍 출력** — 문서가 생성되는 과정을 실시간으로 확인

---

## 시작하기

### 1. Claude API 키 발급

[console.anthropic.com](https://console.anthropic.com)에서 API 키를 발급받으세요.

### 2. 확장프로그램 설정

`Ctrl+,` → ObsiCapture 검색 후 아래 항목을 입력하세요:

| 설정 | 설명 |
|------|------|
| `obsicapture.claudeApiKey` | Anthropic Claude API 키 |
| `obsicapture.vaultPath` | Obsidian Vault 절대 경로 (예: `C:/Users/이름/MyVault`) |
| `obsicapture.defaultFolder` | 기본 저장 폴더 (비워두면 Vault 루트) |
| `obsicapture.maxFiles` | 한 번에 읽을 최대 파일 수 (기본값: 50) |
| `obsicapture.model` | 사용할 Claude 모델 |

### 3. 사용 방법

1. 왼쪽 활동 바의 **ObsiCapture 아이콘** 클릭
2. 원하는 문서 유형 입력 (예: "API 명세서", "README", "아키텍처 문서")
3. **생성** 버튼 클릭 → Claude AI가 프로젝트 코드를 분석해 문서 작성
4. 파일명과 저장 폴더 확인 후 **Obsidian에 저장** 클릭

---

## 지원 모델

| 모델 | 특징 |
|------|------|
| `claude-sonnet-4-6` | 기본값. 속도와 품질의 균형 |
| `claude-opus-4-7` | 최고 품질, 복잡한 문서에 적합 |
| `claude-haiku-4-5` | 빠른 속도, 간단한 문서에 적합 |

---

## 요구 사항

- VS Code 1.85.0 이상
- Anthropic Claude API 키
- Obsidian (문서 저장 시 필요)

---

## 문의 및 버그 리포트

[GitHub Issues](https://github.com/ktmihs/Obsicapture/issues)
