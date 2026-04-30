import * as fs from 'fs/promises';
import * as path from 'path';

export async function saveToObsidian(
	vaultPath: string,
	subFolder: string,
	fileName: string,
	content: string,
): Promise<string> {
	const targetDir = subFolder ? path.join(vaultPath, subFolder) : vaultPath;

	await fs.mkdir(targetDir, { recursive: true });

	const finalName = await resolveFileName(targetDir, fileName);
	const fullPath = path.join(targetDir, finalName);

	await fs.writeFile(fullPath, content, 'utf-8');
	return fullPath;
}

async function resolveFileName(dir: string, fileName: string): Promise<string> {
	const base = fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName;
	let candidate = `${base}.md`;
	let counter = 1;

	while (true) {
		try {
			await fs.access(path.join(dir, candidate));
			candidate = `${base} (${counter}).md`;
			counter++;
		} catch {
			return candidate;
		}
	}
}

export async function listVaultFolders(vaultPath: string): Promise<string[]> {
	const result: string[] = [];

	async function walk(dir: string, rel: string, depth: number) {
		if (depth > 3) {
			return;
		}
		try {
			const entries = await fs.readdir(dir, { withFileTypes: true });
			for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
				if (!e.isDirectory() || e.name.startsWith('.')) {
					continue;
				}
				const next = rel ? `${rel}/${e.name}` : e.name;
				result.push(next);
				await walk(path.join(dir, e.name), next, depth + 1);
			}
		} catch {
			/* ignore */
		}
	}

	await walk(vaultPath, '', 1);
	return ['(vault 루트)', ...result];
}

export async function createVaultFolder(
	vaultPath: string,
	folderPath: string,
): Promise<void> {
	await fs.mkdir(path.join(vaultPath, folderPath), { recursive: true });
}
