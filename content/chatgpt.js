// content/chatgpt.js
// ChatGPT 대화 추출 파서

(function () {
  const SELECTORS = {
    turn: '[data-message-author-role]',
    // fallback
    humanFallback: '.whitespace-pre-wrap',
    aiFallback: '.markdown',
  };

  function extractConversation() {
    let turns = [];

    const allTurns = document.querySelectorAll(SELECTORS.turn);

    if (allTurns.length > 0) {
      turns = Array.from(allTurns).map((el) => ({
        role: el.getAttribute('data-message-author-role') === 'user' ? 'user' : 'assistant',
        content: el.innerText.trim(),
      }));
    } else {
      // fallback: 순서 보장이 어려워 번갈아 배치 가정
      const humanEls = document.querySelectorAll(SELECTORS.humanFallback);
      const aiEls = document.querySelectorAll(SELECTORS.aiFallback);
      const maxLen = Math.max(humanEls.length, aiEls.length);

      for (let i = 0; i < maxLen; i++) {
        if (humanEls[i]) turns.push({ role: 'user', content: humanEls[i].innerText.trim() });
        if (aiEls[i]) turns.push({ role: 'assistant', content: aiEls[i].innerText.trim() });
      }
    }

    return turns.filter((t) => t.content.length > 0);
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

  const observer = new MutationObserver(() => {
    const valid = document.querySelector(SELECTORS.turn);
    if (!valid) {
      console.warn('[ObsiCapture] ChatGPT selector가 변경되었을 수 있습니다.');
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
