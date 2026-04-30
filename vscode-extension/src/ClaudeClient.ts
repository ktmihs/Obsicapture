import Anthropic from '@anthropic-ai/sdk';
import { spawn } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export type ClaudeMode = 'api' | 'cli';

export interface GenerateOptions {
	mode: ClaudeMode;
	apiKey?: string;
	model?: string;
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

function buildUserMessage(codeContext: string, userPrompt: string): string {
	return `다음 프로젝트 코드를 분석하고, 아래 요청에 맞는 문서를 작성해주세요.

요청: ${userPrompt}

---
${codeContext}`;
}

async function generateViaApi(options: GenerateOptions): Promise<void> {
	const { apiKey, model, codeContext, userPrompt, onChunk, onDone, onError } =
		options;

	const client = new Anthropic({ apiKey });

	try {
		const stream = client.messages.stream({
			model: model!,
			max_tokens: 8192,
			system: SYSTEM_PROMPT,
			messages: [
				{ role: 'user', content: buildUserMessage(codeContext, userPrompt) },
			],
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

function generateViaCli(options: GenerateOptions): Promise<void> {
	return new Promise(resolve => {
		const { codeContext, userPrompt, onChunk, onDone, onError } = options;

		const fullPrompt = `${SYSTEM_PROMPT}\n\n${buildUserMessage(codeContext, userPrompt)}`;

		const proc = spawn('claude', ['--print'], { shell: false });

		proc.stdin.write(fullPrompt, 'utf-8');
		proc.stdin.end();

		proc.stdout.on('data', (data: Buffer) => {
			onChunk(data.toString());
		});

		proc.stderr.on('data', (data: Buffer) => {
			const msg = data.toString().trim();
			if (msg) onError(msg);
		});

		proc.on('close', code => {
			if (code === 0) {
				onDone();
			} else {
				onError(`Claude CLI 종료 코드: ${code}`);
			}
			resolve();
		});

		proc.on('error', () => {
			onError(
				'Claude CLI를 찾을 수 없습니다. Claude Code가 설치되고 로그인되어 있는지 확인하세요.',
			);
			resolve();
		});
	});
}

export async function generateDocument(
	options: GenerateOptions,
): Promise<void> {
	if (options.mode === 'cli') {
		await generateViaCli(options);
	} else {
		await generateViaApi(options);
	}
}

export interface CliStatus {
	available: boolean;
	user?: string;
}

export function getCliStatus(): Promise<CliStatus> {
	return new Promise(resolve => {
		const proc = spawn('claude', ['--version'], { shell: false });
		proc.on('close', code => {
			resolve({
				available: code === 0,
				user: code === 0 ? tryReadCliUser() : undefined,
			});
		});
		proc.on('error', () => resolve({ available: false }));
	});
}

function tryReadCliUser(): string | undefined {
	const claudeDir = path.join(os.homedir(), '.claude');
	for (const file of ['settings.json', 'auth.json', 'config.json']) {
		try {
			const data = JSON.parse(
				fs.readFileSync(path.join(claudeDir, file), 'utf-8'),
			);
			const email: string | undefined =
				data.email ?? data.userEmail ?? data.user?.email ?? data.account?.email;
			if (email) {
				return email.includes('@') ? email.split('@')[0] : email;
			}
		} catch {
			/* continue */
		}
	}
	return undefined;
}

export function extractTitle(markdown: string): string {
	const match = markdown.match(/^#\s+(.+)$/m);
	if (!match) return '문서';
	return match[1]
		.trim()
		.replace(/[/\\?%*:|"<>]/g, '-')
		.slice(0, 100);
}
