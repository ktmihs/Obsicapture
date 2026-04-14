// background/summarize.js
// Claude Haiku로 대화 요약 생성

const ANTHROPIC_HEADERS = {
	'anthropic-version': '2023-06-01',
	'anthropic-dangerous-direct-browser-access': 'true',
	'content-type': 'application/json',
};

export async function summarize({
	title,
	conversation,
	platform,
	apiKey,
	customPrompt,
}) {
	const today = new Date().toISOString().slice(0, 10);
	const platformLabel = platform === 'claude' ? 'Claude' : 'ChatGPT';

	const conversationText = conversation
		.map(t => `[${t.role === 'user' ? '나' : 'AI'}] ${t.content}`)
		.join('\n\n');

	const customInstruction = customPrompt
		? `\n추가 지시사항: ${customPrompt}\n`
		: '';

	const prompt = `아래 AI 대화를 Obsidian 노트 형식으로 요약해줘.
반드시 아래 형식 그대로 출력하고, 다른 말은 붙이지 마.${customInstruction}

# ${title}
날짜: ${today}
플랫폼: ${platformLabel}
태그: [대화 주제를 반영한 태그 3~5개를 #태그 형식으로 추가. 예: #번들러 #Vite #빌드도구]

## 핵심 요약
(3~5줄로 핵심만)

## 주요 인사이트
(실제로 얻은 정보, 코드, 해결책 등)

## 더 탐구할 것
(대화에서 나온 미해결 질문이나 더 파볼 주제)

---
대화 내용:
${conversationText}`;

	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: { ...ANTHROPIC_HEADERS, 'x-api-key': apiKey },
		body: JSON.stringify({
			model: 'claude-haiku-4-5-20251001',
			max_tokens: 1024,
			messages: [{ role: 'user', content: prompt }],
		}),
	});

	if (!res.ok) {
		const err = await res.json();
		throw new Error(`Haiku API 오류: ${err.error?.message || res.status}`);
	}

	const data = await res.json();
	return data.content[0].text;
}

export async function extractKeywords({ summaryText, apiKey }) {
	const prompt = `아래 텍스트에서 Obsidian 노트 제목으로 쓸 만한 핵심 키워드를 추출해줘.
키워드는 다른 노트의 제목과 매칭될 수 있도록 구체적이고 명사형으로 작성해줘.
예를 들어 "Vite 번들러", "React 상태 관리", "비동기 처리" 처럼 노트 제목이 될 법한 형태로.
JSON 배열 형식으로만 출력해. 다른 말은 붙이지 마. 최소 5개 이상 추출해줘.
예: ["Vite", "번들러 비교", "SWC 트랜스파일러", "모노레포", "Turborepo"]

텍스트:
${summaryText}`;

	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: { ...ANTHROPIC_HEADERS, 'x-api-key': apiKey },
		body: JSON.stringify({
			model: 'claude-haiku-4-5-20251001',
			max_tokens: 256,
			messages: [{ role: 'user', content: prompt }],
		}),
	});

	const data = await res.json();
	try {
		return JSON.parse(data.content[0].text);
	} catch {
		return [];
	}
}
