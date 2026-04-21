# 📎 ObsiCapture

> AI 대화를 원클릭으로 Obsidian 노트에 저장하는 Chrome 확장 프로그램

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-설치하기-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/obsicapture/mhoalngnmpjeadiicfpfgmnbicfgkhel)

---

## 소개

Claude나 ChatGPT에서 나눈 대화를 복사·붙여넣기 없이, 단 한 번의 클릭으로 Obsidian Vault에 마크다운 파일로 저장합니다.

AI와 나눈 지식을 그냥 흘려보내지 마세요. ObsiCapture로 내 지식 베이스에 차곡차곡 쌓아보세요.

---

## 주요 기능

- **Claude.ai / ChatGPT 지원** — 두 플랫폼 모두 자동 감지
- **AI 자동 정리** — 제목·내용을 Claude Haiku가 자동으로 요약 및 구조화
- **폴더 지정** — 저장할 Vault 폴더를 직접 선택
- **커스텀 지시사항** — "블로그 형식으로", "핵심만 bullet로" 등 원하는 방식으로 정리
- **마크다운 출력** — Obsidian에 최적화된 깔끔한 마크다운 형식

---

## 사용법

### 1단계 — 설정 (최초 1회)

1. 확장 프로그램 설치 후 아이콘 우클릭 → **옵션** 클릭
2. [Anthropic Console](https://console.anthropic.com/keys)에서 API 키 발급 후 입력
3. Obsidian Vault 폴더 선택
4. **설정 저장** 클릭

> Haiku 모델만 사용하므로 비용이 거의 발생하지 않습니다.

### 2단계 — 저장

1. Claude.ai 또는 ChatGPT 대화 페이지 접속
2. 툴바의 📎 ObsiCapture 아이콘 클릭
3. 저장 폴더 및 파일명 확인 (필요 시 수정)
4. **Obsidian에 저장** 클릭 — 끝!

---

## 스크린샷 미리보기 만들기

`screenshots/` 폴더의 HTML 파일들을 브라우저에서 열고 **1280×800** 크기로 캡처하세요.

| 파일 | 내용 |
|------|------|
| `screenshot1.html` | Claude 페이지에서 팝업 사용 |
| `screenshot2.html` | ChatGPT 페이지에서 팝업 사용 |
| `screenshot3.html` | 설정 페이지 |
| `screenshot4.html` | 워크플로우 overview |

---

## 기술 스택

- Chrome Extension Manifest V3
- Claude Haiku API (대화 내용 요약 및 정리)
- File System Access API (Obsidian Vault 직접 저장)

---

## 지원 플랫폼

| 플랫폼 | 지원 여부 |
|--------|-----------|
| Claude.ai | ✅ |
| ChatGPT (chatgpt.com) | ✅ |

---

## 개인정보처리방침

[개인정보처리방침 보기](./privacy-policy.html)

---

## 라이선스

MIT License
