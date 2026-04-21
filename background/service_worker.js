// background/service_worker.js

import { summarize, extractKeywords } from './summarize.js';

chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
	if (msg.type === 'SUMMARIZE_CONVERSATION') {
		handleSummarize(msg.data)
			.then(result => sendResponse({ success: true, result }))
			.catch(err => sendResponse({ success: false, error: err.message }));
		return true;
	}
});

async function handleSummarize({
	platform,
	title,
	conversation,
	customPrompt,
}) {
	const settings = await getSettings();

	if (settings.summarizeMode === 'raw') {
		const summaryRaw = formatRaw({ title, conversation, platform });
		const fileName = sanitize(title) || '대화 내용';
		return { fileName, summaryRaw, keywords: [] };
	}

	if (!settings.claudeApiKey)
		throw new Error('Claude API 키가 설정되지 않았습니다.');

	sendStatus('요약 생성 중...');
	const summaryRaw = await summarize({
		title,
		conversation,
		platform,
		apiKey: settings.claudeApiKey,
		customPrompt,
	});
	const summaryClean = sanitizeTags(summaryRaw);

	sendStatus('키워드 추출 중...');
	const keywords = await extractKeywords({
		summaryText: summaryClean,
		apiKey: settings.claudeApiKey,
	});
	const fileName = extractTitle(summaryClean) || sanitize(title);

	return { fileName, summaryRaw: summaryClean, keywords };
}

function formatRaw({ title, conversation, platform }) {
	const today = new Date().toISOString().slice(0, 10);
	const platformLabel = platform === 'claude' ? 'Claude' : 'ChatGPT';
	const body = conversation
		.map(t => `**${t.role === 'user' ? '나' : 'AI'}**\n\n${t.content}`)
		.join('\n\n---\n\n');
	return `# ${title}\n날짜: ${today}\n플랫폼: ${platformLabel}\n\n---\n\n${body}`;
}

function sanitizeTags(text) {
	return text.replace(/^(태그:.*)$/m, line => {
		return line.replace(
			/#([^\s#][^\s#]*(?:\s+(?![#\n])[^\s#]+)*)/g,
			(match, tagBody) => {
				const clean = tagBody
					.trim()
					.replace(/\s+/g, '-')
					.replace(/-+/g, '-')
					.replace(/-$/, '');
				return `#${clean}`;
			},
		);
	});
}

function extractTitle(text) {
	const match = text.match(/^#\s+(.+)$/m);
	return match ? sanitize(match[1].trim()) : null;
}

function sanitize(str) {
	return str
		.replace(/[/\\?%*:|"<>]/g, '-')
		.trim()
		.slice(0, 100);
}

async function getSettings() {
	return new Promise(resolve =>
		chrome.storage.sync.get(['claudeApiKey', 'summarizeMode'], resolve),
	);
}

function sendStatus(message) {
	chrome.runtime
		.sendMessage({ type: 'STATUS_UPDATE', message })
		.catch(() => {});
}
