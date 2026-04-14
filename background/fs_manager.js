// background/fs_manager.js
// IndexedDB에 FileSystemDirectoryHandle 저장/로드만 담당
// 실제 파일 읽기/쓰기는 popup.js에서 처리 (File System Access API는 service worker 불가)

const DB_NAME = 'obsicapture';
const DB_VERSION = 1;
const STORE_NAME = 'handles';

function openDB() {
	return new Promise((resolve, reject) => {
		const idb = self.indexedDB || indexedDB;
		const req = idb.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export async function saveVaultHandle(handle) {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		tx.objectStore(STORE_NAME).put(handle, 'vaultDir');
		tx.oncomplete = resolve;
		tx.onerror = () => reject(tx.error);
	});
}

export async function loadVaultHandle() {
	const db = await openDB();
	return new Promise(resolve => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const req = tx.objectStore(STORE_NAME).get('vaultDir');
		req.onsuccess = () => resolve(req.result || null);
		req.onerror = () => resolve(null);
	});
}

export async function checkPermission(handle) {
	if (!handle) return 'no-handle';
	try {
		const perm = await handle.queryPermission({ mode: 'readwrite' });
		return perm;
	} catch {
		return 'error';
	}
}
