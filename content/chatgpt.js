// content/chatgpt.js

(function () {
	const SELECTORS = {
		turn: '[data-message-author-role]',
		humanFallback: '.whitespace-pre-wrap',
		aiFallback: '.markdown',
	};

	// ChatGPT UI 잔여 텍스트 제거
	const UI_ARTIFACT_PATTERNS = [
		/^\(웹 검색됨\)$/,
		/^웹 검색됨$/,
		/^Searched the web$/,
		/^이미지 생성됨$/,
		/^메모리 업데이트됨$/,
		/^Memory updated$/,
		/^검색 결과 \d+개$/,
		/^[\d]+ results?$/,
		/^(GPT-4o?|4o|4o-mini|o1|o1-mini|o3|o3-mini)$/,
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
		let turns = [];

		const allTurns = document.querySelectorAll(SELECTORS.turn);

		if (allTurns.length > 0) {
			turns = Array.from(allTurns).map(el => ({
				role:
					el.getAttribute('data-message-author-role') === 'user'
						? 'user'
						: 'assistant',
				content: cleanContent(el.innerText.trim()),
			}));
		} else {
			const humanEls = document.querySelectorAll(SELECTORS.humanFallback);
			const aiEls = document.querySelectorAll(SELECTORS.aiFallback);
			const maxLen = Math.max(humanEls.length, aiEls.length);
			for (let i = 0; i < maxLen; i++) {
				if (humanEls[i])
					turns.push({
						role: 'user',
						content: cleanContent(humanEls[i].innerText.trim()),
					});
				if (aiEls[i])
					turns.push({
						role: 'assistant',
						content: cleanContent(aiEls[i].innerText.trim()),
					});
			}
		}

		return turns.filter(t => t.content.length > 0);
	}

	function getPageTitle() {
		return document.title?.replace('ChatGPT - ', '').trim() || '제목 없음';
	}

	chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
		if (msg.type === 'GET_CONVERSATION') {
			const conversation = extractConversation();
			const title = getPageTitle();
			sendResponse({
				platform: 'chatgpt',
				title,
				conversation,
				url: window.location.href,
			});
		}
		return true;
	});
})();
