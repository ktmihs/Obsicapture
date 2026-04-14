// popup/popup.js
// 로컬 저장은 여기서 File System Access API로 직접 처리
// service worker는 요약/키워드/Drive/Webhook만 담당

const platformBadge = document.getElementById('platform-badge');
const titlePreview = document.getElementById('title-preview');
const folderSelect = document.getElementById('folder-select');
const labelFolder = document.getElementById('label-folder');
const customPromptInput = document.getElementById('custom-prompt');
const filenameInput = document.getElementById('filename-input');
const labelFilename = document.getElementById('label-filename');
const saveBtn = document.getElementById('save-btn');
const confirmBtn = document.getElementById('confirm-btn');
const statusEl = document.getElementById('status');
const settingsLink = document.getElementById('settings-link');

let currentTab = null;
let conversationData = null;
let pendingSummary = null;

const PLATFORM_INFO = {
	claude: { label: '🟣 Claude', className: 'claude' },
	chatgpt: { label: '🟢 ChatGPT', className: 'chatgpt' },
	unknown: { label: '⚪ 미지원 페이지', className: 'unknown' },
};

// IndexedDB에서 vault 핸들 로드
async function loadVaultHandle() {
	return new Promise(resolve => {
		const req = indexedDB.open('obsicapture', 2);
		req.onupgradeneeded = e => {
			const db = e.target.result;
			if (!db.objectStoreNames.contains('handles')) {
				db.createObjectStore('handles');
			}
		};
		req.onsuccess = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains('handles')) return resolve(null);
			const tx = db.transaction('handles', 'readonly');
			const r = tx.objectStore('handles').get('vaultDir');
			r.onsuccess = () => resolve(r.result || null);
			r.onerror = () => resolve(null);
		};
		req.onerror = () => resolve(null);
	});
}

// vault 서브폴더 목록
async function getVaultFolders(handle) {
	const folders = ['(vault 루트)'];
	for await (const [name, entry] of handle.entries()) {
		if (entry.kind === 'directory' && !name.startsWith('.')) folders.push(name);
	}
	return folders.sort((a, b) =>
		a === '(vault 루트)' ? -1 : a.localeCompare(b),
	);
}

// 파일 저장 (중복 시 (1),(2) 처리)
async function writeFile(dirHandle, fileName, content, subFolder) {
	let targetHandle = dirHandle;
	if (subFolder && subFolder !== '(vault 루트)') {
		targetHandle = await dirHandle.getDirectoryHandle(subFolder, {
			create: true,
		});
	}
	const baseName = fileName.replace(/\.md$/, '');
	let finalName = `${baseName}.md`;
	let counter = 1;
	while (true) {
		try {
			await targetHandle.getFileHandle(finalName, { create: false });
			finalName = `${baseName} (${counter}).md`;
			counter++;
		} catch {
			break;
		}
	}
	// 파일 핸들을 create: true로 새로 가져와서 stale 방지
	const fileHandle = await targetHandle.getFileHandle(finalName, {
		create: true,
	});
	const writable = await fileHandle.createWritable();
	await writable.write(content);
	await writable.close();
	return finalName;
}

// 태그 추출
function extractTags(content) {
	const matches = content.match(/#[\w가-힣ㄱ-ㅎㅏ-ㅣ.]+/g) || [];
	return new Set(
		matches
			.map(t => t.replace(/\.+$/, '').toLowerCase())
			.filter(t => t.length > 1),
	);
}

// 역방향 링크 삽입
async function updateBacklinks(dirHandle, newFileName, newContent) {
	const newNameNoExt = newFileName.replace(/\.md$/, '');
	const newTags = extractTags(newContent);
	const EXCLUDE = new Set(['#ai-chat', '#obsicapture', '#ai', '#chat']);
	const meaningfulTags = new Set([...newTags].filter(t => !EXCLUDE.has(t)));
	if (meaningfulTags.size === 0) return 0;

	let updatedCount = 0;
	await traverse(dirHandle);
	return updatedCount;

	async function traverse(handle) {
		for await (const [name, entry] of handle.entries()) {
			if (entry.kind === 'directory' && !name.startsWith('.')) {
				await traverse(entry);
			} else if (entry.kind === 'file' && name.endsWith('.md')) {
				const existingNameNoExt = name.replace(/\.md$/, '');
				if (existingNameNoExt === newNameNoExt) continue;
				const file = await entry.getFile();
				let content = await file.text();
				const existingTags = extractTags(content);
				const meaningfulExisting = new Set(
					[...existingTags].filter(t => !EXCLUDE.has(t)),
				);
				const commonTags = [...meaningfulTags].filter(t =>
					meaningfulExisting.has(t),
				);
				if (commonTags.length > 0) {
					const updated = insertLink(content, newNameNoExt);
					if (updated !== content) {
						// entry 대신 handle에서 fresh하게 다시 가져와서 stale 방지
						const freshEntry = await handle.getFileHandle(name);
						const writable = await freshEntry.createWritable();
						await writable.write(updated);
						await writable.close();
						updatedCount++;
					}
				}
			}
		}
	}
}

function insertLink(text, noteName) {
	const escaped = noteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const alreadyLinked = new RegExp(`\\[\\[${escaped}\\]\\]`);
	if (alreadyLinked.test(text)) return text;
	if (text.includes('## 관련 노트')) {
		return text.replace('## 관련 노트\n', `## 관련 노트\n- [[${noteName}]]\n`);
	}
	return text + `\n\n## 관련 노트\n- [[${noteName}]]\n`;
}

// 초기화
(async () => {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	currentTab = tab;
	const platform = detectPlatform(tab.url);

	if (platform === 'unknown') {
		platformBadge.textContent = '⚪ 미지원 페이지';
		platformBadge.className = 'platform-badge unknown';
		titlePreview.textContent =
			'Claude.ai 또는 ChatGPT 페이지에서 사용해주세요.';
		return;
	}

	platformBadge.textContent = PLATFORM_INFO[platform].label;
	platformBadge.className = `platform-badge ${PLATFORM_INFO[platform].className}`;

	// 설정 확인
	const settings = await new Promise(r =>
		chrome.storage.sync.get(['saveMethod', 'claudeApiKey'], r),
	);

	if (settings.saveMethod === 'local' || !settings.saveMethod) {
		const handle = await loadVaultHandle();
		if (!handle) {
			setStatus(
				'error',
				'❌ Vault 폴더가 설정되지 않았습니다.\n⚙️ 설정에서 폴더를 선택해주세요.',
			);
			return;
		}

		// 초기화 시엔 queryPermission만 (requestPermission은 저장 버튼 클릭 시)
		const perm = await handle.queryPermission({ mode: 'readwrite' });
		if (perm === 'denied') {
			setStatus(
				'error',
				'❌ 폴더 접근이 거부됐어요.\n⚙️ 설정에서 폴더를 다시 선택해주세요.',
			);
			return;
		}
		// perm이 'granted' 또는 'prompt'면 계속 진행 (저장 시점에 requestPermission 호출)
		// 폴더 목록 로드
		try {
			const folders = await getVaultFolders(handle);
			if (folders.length > 1) {
				folderSelect.innerHTML = folders
					.map(f => `<option value="${f}">${f}</option>`)
					.join('');
				const saved = await new Promise(r =>
					chrome.storage.local.get(['lastFolder'], r),
				);
				if (saved.lastFolder) {
					const opt = [...folderSelect.options].find(
						o => o.value === saved.lastFolder,
					);
					if (opt) folderSelect.value = saved.lastFolder;
				}
				folderSelect.classList.add('visible');
				labelFolder.classList.add('visible');
			}
		} catch {}
	}

	try {
		await chrome.scripting
			.executeScript({
				target: { tabId: tab.id },
				files: [`content/${platform}.js`],
			})
			.catch(() => {});

		const response = await chrome.tabs.sendMessage(tab.id, {
			type: 'GET_CONVERSATION',
		});
		conversationData = response;

		if (!response.conversation || response.conversation.length === 0) {
			titlePreview.textContent = '대화 내용을 찾을 수 없습니다.';
			return;
		}

		titlePreview.textContent = response.title || '제목 없음';
		saveBtn.disabled = false;
	} catch (e) {
		titlePreview.textContent = '페이지를 새로고침 후 다시 시도해주세요.';
		setStatus('error', '콘텐츠 스크립트 오류: ' + e.message);
	}
})();

folderSelect.addEventListener('change', () => {
	chrome.storage.local.set({ lastFolder: folderSelect.value });
});

// 1단계: 요약 생성
saveBtn.addEventListener('click', async () => {
	if (!conversationData) return;
	saveBtn.disabled = true;
	confirmBtn.style.display = 'none';
	filenameInput.classList.remove('visible');
	labelFilename.classList.remove('visible');
	setStatus('loading', '⏳ 요약 생성 중...');

	function statusListener(msg) {
		if (msg.type === 'STATUS_UPDATE') setStatus('loading', `⏳ ${msg.message}`);
	}
	chrome.runtime.onMessage.addListener(statusListener);

	const response = await chrome.runtime.sendMessage({
		type: 'SUMMARIZE_CONVERSATION',
		data: {
			...conversationData,
			customPrompt: customPromptInput.value.trim() || null,
		},
	});

	chrome.runtime.onMessage.removeListener(statusListener);

	if (response.success) {
		pendingSummary = response.result;
		filenameInput.value = response.result.fileName;
		filenameInput.classList.add('visible');
		labelFilename.classList.add('visible');
		confirmBtn.style.display = 'flex';
		setStatus('loading', '⏳ 파일명 확인 후 저장해주세요.');
		saveBtn.disabled = false;
	} else {
		setStatus('error', `❌ 오류: ${response.error}`);
		saveBtn.disabled = false;
	}
});

// 2단계: 저장
confirmBtn.addEventListener('click', async () => {
	if (!pendingSummary) return;
	confirmBtn.disabled = true;
	saveBtn.disabled = true;

	// 클릭 직후 즉시 권한 요청 (user activation 소멸 전)
	const handle = await loadVaultHandle();
	if (!handle) {
		setStatus('error', '❌ Vault 폴더가 설정되지 않았습니다.');
		confirmBtn.disabled = false;
		saveBtn.disabled = false;
		return;
	}
	let perm = await handle.queryPermission({ mode: 'readwrite' });
	if (perm === 'prompt')
		perm = await handle.requestPermission({ mode: 'readwrite' });
	if (perm !== 'granted') {
		setStatus(
			'error',
			'❌ 폴더 접근 권한이 필요해요.\n⚙️ 설정에서 폴더를 다시 선택해주세요.',
		);
		confirmBtn.disabled = false;
		saveBtn.disabled = false;
		return;
	}

	setStatus('loading', '⏳ 저장 중...');
	const fileName = filenameInput.value.trim() || pendingSummary.fileName;
	const subFolder = folderSelect.value || '(vault 루트)';
	const { summaryRaw } = pendingSummary;

	function statusListener(msg) {
		if (msg.type === 'STATUS_UPDATE') setStatus('loading', `⏳ ${msg.message}`);
	}
	chrome.runtime.onMessage.addListener(statusListener);

	try {
		setStatus('loading', '⏳ Obsidian에 저장 중...');
		const finalFileName = await writeFile(
			handle,
			fileName,
			summaryRaw,
			subFolder,
		);

		setStatus('loading', '⏳ 링크 생성 중...');
		const updatedCount = await updateBacklinks(
			handle,
			finalFileName,
			summaryRaw,
		);

		filenameInput.classList.remove('visible');
		labelFilename.classList.remove('visible');
		confirmBtn.style.display = 'none';
		confirmBtn.disabled = false;

		const msg =
			updatedCount > 0
				? `✅ 저장 완료!\n📄 ${finalFileName}\n🔗 기존 노트 ${updatedCount}개에 링크 추가됨`
				: `✅ 저장 완료!\n📄 ${finalFileName}`;
		setStatus('success', msg);
		pendingSummary = null;
		saveBtn.disabled = false;
	} catch (e) {
		chrome.runtime.onMessage.removeListener(statusListener);
		if (e.message === 'PERMISSION_REQUIRED') {
			setStatus(
				'error',
				'❌ 폴더 접근 권한이 만료됐어요.\n⚙️ 설정에서 폴더를 다시 선택해주세요.',
			);
		} else {
			setStatus('error', `❌ 오류: ${e.message}`);
		}
		confirmBtn.disabled = false;
		saveBtn.disabled = false;
	}
});

settingsLink.addEventListener('click', () => chrome.runtime.openOptionsPage());

function detectPlatform(url) {
	if (url?.includes('claude.ai')) return 'claude';
	if (url?.includes('chatgpt.com')) return 'chatgpt';
	return 'unknown';
}

function setStatus(type, message) {
	statusEl.className = `status ${type}`;
	statusEl.textContent = message;
}
