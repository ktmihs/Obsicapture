// options/options.js

const claudeApiKeyInput = document.getElementById('claude-api-key');
const apiKeyCard = document.getElementById('api-key-card');
const folderPickerBtn = document.getElementById('folder-picker-btn');
const folderSelectedEl = document.getElementById('folder-selected');
const saveBtn = document.getElementById('save-btn');
const toast = document.getElementById('toast');
const modeRadios = document.querySelectorAll('input[name="mode"]');

const DB_NAME = 'obsicapture';

function openDB() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 2);
		req.onupgradeneeded = e => {
			const db = e.target.result;
			if (!db.objectStoreNames.contains('handles')) {
				db.createObjectStore('handles');
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function saveHandle(handle) {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('handles', 'readwrite');
		tx.objectStore('handles').put(handle, 'vaultDir');
		tx.oncomplete = resolve;
		tx.onerror = () => reject(tx.error);
	});
}

async function loadHandle() {
	const db = await openDB();
	return new Promise(resolve => {
		const tx = db.transaction('handles', 'readonly');
		const req = tx.objectStore('handles').get('vaultDir');
		req.onsuccess = () => resolve(req.result || null);
		req.onerror = () => resolve(null);
	});
}

function getSelectedMode() {
	return (
		document.querySelector('input[name="mode"]:checked')?.value ?? 'summarize'
	);
}

function applyModeUI(mode) {
	apiKeyCard.style.display = mode === 'raw' ? 'none' : 'block';
}

// 저장된 설정 불러오기
(async () => {
	chrome.storage.sync.get(
		['claudeApiKey', 'vaultDirName', 'summarizeMode'],
		data => {
			const mode = data.summarizeMode ?? 'summarize';
			const radio = document.querySelector(
				`input[name="mode"][value="${mode}"]`,
			);
			if (radio) radio.checked = true;
			applyModeUI(mode);

			if (data.claudeApiKey) claudeApiKeyInput.value = data.claudeApiKey;
			if (data.vaultDirName) showFolderSelected(data.vaultDirName);
		},
	);

	const handle = await loadHandle();
	if (handle) {
		const perm = await handle.queryPermission({ mode: 'readwrite' });
		if (perm === 'granted') showFolderSelected(handle.name);
	}
})();

// 모드 전환 시 API 키 카드 토글
modeRadios.forEach(radio => {
	radio.addEventListener('change', () => applyModeUI(getSelectedMode()));
});

// 폴더 선택
folderPickerBtn.addEventListener('click', async () => {
	try {
		const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
		const perm = await dirHandle.requestPermission({ mode: 'readwrite' });
		if (perm !== 'granted') {
			showToast('❌ 폴더 접근 권한이 필요해요.');
			return;
		}
		await saveHandle(dirHandle);
		chrome.storage.sync.set({ vaultDirName: dirHandle.name });
		showFolderSelected(dirHandle.name);
		showToast(`✅ "${dirHandle.name}" 폴더가 설정됐어요!`);
	} catch (e) {
		if (e.name !== 'AbortError') showToast('❌ 폴더 선택 실패: ' + e.message);
	}
});

// 설정 저장
saveBtn.addEventListener('click', () => {
	const mode = getSelectedMode();
	const claudeApiKey = claudeApiKeyInput.value.trim();

	if (mode === 'summarize' && !claudeApiKey) {
		showToast('❌ Claude API 키를 입력해주세요.');
		return;
	}

	const toSave = { summarizeMode: mode };
	if (claudeApiKey) toSave.claudeApiKey = claudeApiKey;

	chrome.storage.sync.set(toSave, () => {
		showToast('✅ 설정이 저장됐어요!');
		setTimeout(() => window.close(), 1500);
	});
});

function showFolderSelected(name) {
	folderSelectedEl.textContent = `✅ ${name}`;
	folderSelectedEl.style.display = 'block';
}

function showToast(message) {
	toast.textContent = message;
	toast.classList.add('show');
	setTimeout(() => toast.classList.remove('show'), 2500);
}
