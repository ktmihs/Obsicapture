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
	try {
		const entries = await fs.readdir(vaultPath, { withFileTypes: true });
		const folders = entries
			.filter(e => e.isDirectory() && !e.name.startsWith('.'))
			.map(e => e.name)
			.sort();
		return ['(vault 루트)', ...folders];
	} catch {
		return ['(vault 루트)'];
	}
}
