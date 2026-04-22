import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

const EXCLUDE_DIRS = new Set([
	'node_modules',
	'.git',
	'.next',
	'dist',
	'build',
	'out',
	'.nuxt',
	'.cache',
	'coverage',
	'__pycache__',
	'.venv',
	'venv',
	'.idea',
	'.vscode',
	'vendor',
]);

const EXCLUDE_EXTS = new Set([
	'.png',
	'.jpg',
	'.jpeg',
	'.gif',
	'.svg',
	'.ico',
	'.webp',
	'.mp4',
	'.mp3',
	'.pdf',
	'.zip',
	'.tar',
	'.gz',
	'.lock',
	'.map',
	'.min.js',
	'.min.css',
	'.woff',
	'.woff2',
	'.ttf',
	'.eot',
]);

const INCLUDE_EXTS = new Set([
	'.ts',
	'.tsx',
	'.js',
	'.jsx',
	'.mjs',
	'.cjs',
	'.py',
	'.go',
	'.rs',
	'.java',
	'.kt',
	'.swift',
	'.c',
	'.cpp',
	'.h',
	'.html',
	'.css',
	'.scss',
	'.less',
	'.json',
	'.yaml',
	'.yml',
	'.toml',
	'.env.example',
	'.md',
	'.mdx',
	'.sql',
	'.graphql',
	'.prisma',
	'.sh',
	'.bash',
]);

export interface ProjectFile {
	relativePath: string;
	content: string;
	lines: number;
}

export interface ProjectContext {
	name: string;
	rootPath: string;
	files: ProjectFile[];
	totalLines: number;
	estimatedTokens: number;
}

export async function readProjectFiles(
	maxFiles: number,
): Promise<ProjectContext> {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		throw new Error('열린 워크스페이스가 없습니다.');
	}

	const root = workspaceFolders[0].uri.fsPath;
	const projectName = path.basename(root);

	const gitignorePatterns = await loadGitignore(root);
	const files: ProjectFile[] = [];

	await walkDir(root, root, files, gitignorePatterns, maxFiles);

	const totalLines = files.reduce((sum, f) => sum + f.lines, 0);
	const totalChars = files.reduce((sum, f) => sum + f.content.length, 0);
	const estimatedTokens = Math.round(totalChars / 4);

	return {
		name: projectName,
		rootPath: root,
		files,
		totalLines,
		estimatedTokens,
	};
}

async function walkDir(
	root: string,
	dir: string,
	results: ProjectFile[],
	gitignorePatterns: string[],
	maxFiles: number,
): Promise<void> {
	if (results.length >= maxFiles) return;

	let entries: import('fs').Dirent[];
	try {
		entries = await fs.readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}

	for (const entry of entries) {
		if (results.length >= maxFiles) break;

		const fullPath = path.join(dir, entry.name);
		const relPath = path.relative(root, fullPath).replace(/\\/g, '/');

		if (isExcluded(entry.name, relPath, gitignorePatterns)) continue;

		if (entry.isDirectory()) {
			await walkDir(root, fullPath, results, gitignorePatterns, maxFiles);
		} else if (entry.isFile()) {
			const ext = path.extname(entry.name).toLowerCase();
			if (!INCLUDE_EXTS.has(ext)) continue;
			if (EXCLUDE_EXTS.has(ext)) continue;

			try {
				const stat = await fs.stat(fullPath);
				if (stat.size > 100 * 1024) continue; // 100KB 초과 파일 제외

				const content = await fs.readFile(fullPath, 'utf-8');
				const lines = content.split('\n').length;
				results.push({ relativePath: relPath, content, lines });
			} catch {
				// 읽기 실패한 파일은 건너뜀
			}
		}
	}
}

function isExcluded(
	name: string,
	relPath: string,
	gitignorePatterns: string[],
): boolean {
	if (EXCLUDE_DIRS.has(name)) return true;
	if (name.startsWith('.') && name !== '.env.example') return true;

	for (const pattern of gitignorePatterns) {
		if (relPath.startsWith(pattern) || relPath === pattern) return true;
		if (name === pattern) return true;
	}

	return false;
}

async function loadGitignore(root: string): Promise<string[]> {
	try {
		const content = await fs.readFile(path.join(root, '.gitignore'), 'utf-8');
		return content
			.split('\n')
			.map(l => l.trim())
			.filter(l => l && !l.startsWith('#'))
			.map(l => l.replace(/^\//, '').replace(/\/$/, ''));
	} catch {
		return [];
	}
}

export function formatFilesForPrompt(ctx: ProjectContext): string {
	const header = `프로젝트: ${ctx.name}\n파일 수: ${ctx.files.length}개 | 총 ${ctx.totalLines.toLocaleString()}줄\n\n`;
	const fileContents = ctx.files
		.map(
			f =>
				`\`\`\`${getLanguage(f.relativePath)}\n// ${f.relativePath}\n${f.content}\n\`\`\``,
		)
		.join('\n\n');
	return header + fileContents;
}

function getLanguage(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase();
	const map: Record<string, string> = {
		'.ts': 'typescript',
		'.tsx': 'tsx',
		'.js': 'javascript',
		'.jsx': 'jsx',
		'.py': 'python',
		'.go': 'go',
		'.rs': 'rust',
		'.java': 'java',
		'.html': 'html',
		'.css': 'css',
		'.scss': 'scss',
		'.json': 'json',
		'.yaml': 'yaml',
		'.yml': 'yaml',
		'.md': 'markdown',
		'.sql': 'sql',
		'.sh': 'bash',
	};
	return map[ext] ?? '';
}
