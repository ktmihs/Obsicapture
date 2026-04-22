import Anthropic from '@anthropic-ai/sdk';

export interface GenerateOptions {
	apiKey: string;
	model: string;
	codeContext: string;
	userPrompt: string;
	onChunk: (text: string) => void;
	onDone: () => void;
	onError: (error: string) => void;
}

const SYSTEM_PROMPT = `당신은 소프트웨어 프로젝트 문서화 전문가입니다.
제공된 프로젝트 코드를 분석하고, 사용자가 요청한 문서를 Obsidian 마크다운 형식으로 작성합니다.

규칙:
- 마크다운 형식으로만 출력 (코드 블록, 헤딩, 리스트 등 적극 활용)
- 한국어로 작성 (코드, 변수명, 파일명은 그대로 유지)
- 실제 코드 내용을 기반으로 정확하게 작성
- 추측이나 거짓 정보 없이 코드에서 확인된 내용만 작성
- 첫 번째 줄은 반드시 # 제목 형식으로 시작`;

export async function generateDocument(
	options: GenerateOptions,
): Promise<void> {
	const { apiKey, model, codeContext, userPrompt, onChunk, onDone, onError } =
		options;

	const client = new Anthropic({ apiKey });

	const userMessage = `다음 프로젝트 코드를 분석하고, 아래 요청에 맞는 문서를 작성해주세요.

요청: ${userPrompt}

---
${codeContext}`;

	try {
		const stream = client.messages.stream({
			model,
			max_tokens: 8192,
			system: SYSTEM_PROMPT,
			messages: [{ role: 'user', content: userMessage }],
		});

		for await (const event of stream) {
			if (
				event.type === 'content_block_delta' &&
				event.delta.type === 'text_delta'
			) {
				onChunk(event.delta.text);
			}
		}

		onDone();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		onError(message);
	}
}

export function extractTitle(markdown: string): string {
	const match = markdown.match(/^#\s+(.+)$/m);
	if (!match) return '문서';
	return match[1]
		.trim()
		.replace(/[/\\?%*:|"<>]/g, '-')
		.slice(0, 100);
}
