// content/claude.js

(function () {
	const SELECTORS = {
		humanTurn: '[data-testid="user-message"]',
		aiTurn: '.font-claude-response',
		turnContainer: '[data-test-render-count]',
	};

	// Claude UI 잔여 텍스트 제거
	const UI_ARTIFACT_PATTERNS = [
		/^복사$/,
		/^Copy$/,
		/^재시도$/,
		/^Retry$/,
		/^편집$/,
		/^Edit$/,
		/^\d+\s*\/\s*\d+$/, // "1 / 3" 같은 페이지 표시
	];

	function cleanContent(text) {
		return text
			.split('\n')
			.filter(line => {
				const trimmed = line.trim();
				return !UI_ARTIFACT_PATTERNS.some(p => p.test(trimmed));
			})
			.join('\n')
			.replace(/\n{3,}/g, '\n\n')
			.trim();
	}

	function extractConversation() {
		const turns = [];
		const containers = document.querySelectorAll(SELECTORS.turnContainer);

		containers.forEach(container => {
			const human = container.querySelector(SELECTORS.humanTurn);
			const ai = container.querySelector(SELECTORS.aiTurn);

			if (human) {
				turns.push({
					role: 'user',
					content: cleanContent(human.innerText.trim()),
				});
			}
			if (ai) {
				turns.push({
					role: 'assistant',
					content: cleanContent(ai.innerText.trim()),
				});
			}
		});

		return turns.filter(t => t.content.length > 0);
	}

	function getPageTitle() {
		return document.title?.replace(' - Claude', '').trim() || '제목 없음';
	}

	chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
		if (msg.type === 'GET_CONVERSATION') {
			const conversation = extractConversation();
			const title = getPageTitle();
			sendResponse({
				platform: 'claude',
				title,
				conversation,
				url: window.location.href,
			});
		}
		return true;
	});
})();
