// content/claude.js
// Claude.ai 대화 추출 파서

(function () {
  const SELECTORS = {
    humanTurn: '[data-testid="user-message"]',
    aiTurn: '.font-claude-response',
    turnContainer: '[data-test-render-count]',
  };

  function extractConversation() {
    const turns = [];
    const containers = document.querySelectorAll(SELECTORS.turnContainer);

    containers.forEach(container => {
      const human = container.querySelector(SELECTORS.humanTurn);
      const ai = container.querySelector(SELECTORS.aiTurn);

      if (human) {
        turns.push({ role: 'user', content: human.innerText.trim() });
      }
      if (ai) {
        turns.push({ role: 'assistant', content: ai.innerText.trim() });
      }
    });

    return turns.filter(t => t.content.length > 0);
  }

  function getPageTitle() {
    return document.title?.replace(' - Claude', '').trim() || '제목 없음';
  }

  // 팝업에서 메시지 수신
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

  console.log('[ObsiCapture] claude.js 로드됨', window.location.href);
})();