import { BrowserWindow, dialog } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function validateWorkspacePath(folderPath: string) {
  if (typeof folderPath !== 'string') {
    throw new Error('Workspace path must be a string.');
  }

  const trimmed = folderPath.trim();
  if (!trimmed) {
    throw new Error('Workspace path is empty.');
  }

  const normalized = path.resolve(trimmed);
  const stats = await fs.stat(normalized);
  if (!stats.isDirectory()) {
    throw new Error('Workspace path must be a folder.');
  }

  await fs.access(normalized);
  return normalized;
}

export async function selectWorkspaceFolder(mainWindow: BrowserWindow | null) {
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
    : await dialog.showOpenDialog({ properties: ['openDirectory'] });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return validateWorkspacePath(result.filePaths[0]);
}

export async function readDirectoryContents(dirPath: string) {
  const normalized = path.resolve(dirPath);
  const entries = await fs.readdir(normalized, { withFileTypes: true });
  const ignoreDirs = new Set(['.git', 'node_modules', 'dist', '.vite', '.output', '.next', 'out', 'build', '.gemini']);
  
  const results = [];
  for (const entry of entries) {
    if (ignoreDirs.has(entry.name)) continue;

    const fullPath = path.join(normalized, entry.name);
    let size = 0;
    try {
      if (!entry.isDirectory()) {
        const stats = await fs.stat(fullPath);
        size = stats.size;
      }
    } catch {
      // ignore stat errors
    }

    results.push({
      name: entry.name,
      path: fullPath,
      isDirectory: entry.isDirectory(),
      size,
      ext: entry.isDirectory() ? '' : path.extname(entry.name).toLowerCase()
    });
  }

  results.sort((first, second) => {
    if (first.isDirectory && !second.isDirectory) return -1;
    if (!first.isDirectory && second.isDirectory) return 1;
    return first.name.localeCompare(second.name);
  });

  return results;
}

export async function searchWorkspaceFiles(workspacePath: string, query: string) {
  const ignoreDirs = new Set(['.git', 'node_modules', 'dist', '.vite', '.output', '.next', 'out', 'build', '.gemini']);
  const results: { path: string; relPath: string; line: number; text: string }[] = [];
  const queryLower = query.toLowerCase();

  async function scan(currentDir: string) {
    if (results.length >= 100) return;

    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= 100) return;
      if (ignoreDirs.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        try {
          await scan(fullPath);
        } catch {
          // ignore unreadable folders
        }
      } else {
        const relPath = path.relative(workspacePath, fullPath);

        // 1. Check if file name matches the query (File name match)
        const nameMatches = entry.name.toLowerCase().includes(queryLower);
        if (nameMatches && results.length < 100) {
          results.push({
            path: fullPath,
            relPath,
            line: 1,
            text: `[File Name Match] ${entry.name}`
          });
        }

        // 2. Check if content matches (only for text/source files)
        const ext = path.extname(entry.name).toLowerCase();
        const textExtensions = [
          '.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.css', '.md', '.txt', 
          '.yml', '.yaml', '.sh', '.py', '.java', '.go', '.rs', '.gitignore', 
          '.eslintignore', '.prettierignore', '.env', '.env.example', '.env.local', 
          '.env.development', '.env.production', '.babelrc', '.eslintrc', '.prettierrc', 
          '.editorconfig', '.npmrc', '.toml', '.xml', '.ini', '.conf'
        ];
        const noExtAllowed = new Set(['dockerfile', 'makefile', 'procfile', 'license']);

        if (textExtensions.includes(ext) || (ext === '' && noExtAllowed.has(entry.name.toLowerCase()))) {
          try {
            const content = await fs.readFile(fullPath, 'utf8');
            if (content.toLowerCase().includes(queryLower)) {
              const lines = content.split(/\r?\n/);
              lines.forEach((lineText, idx) => {
                if (results.length >= 100) return;
                if (lineText.toLowerCase().includes(queryLower)) {
                  results.push({
                    path: fullPath,
                    relPath,
                    line: idx + 1,
                    text: lineText.trim().slice(0, 120)
                  });
                }
              });
            }
          } catch {
            // ignore unreadable files
          }
        }
      }
    }
  }

  try {
    await scan(path.resolve(workspacePath));
  } catch (err) {
    console.error('Failed to search workspace files:', err);
  }
  return results;
}

function resolveWorkspacePath(wsRoot: string, targetPath: string): string {
  if (path.isAbsolute(targetPath)) {
    return path.resolve(targetPath);
  }
  return path.resolve(wsRoot, targetPath);
}

function isPathInside(childPath: string, parentPath: string): boolean {
  const isWindows = process.platform === 'win32';
  let pParent = path.resolve(parentPath);
  let pChild = path.resolve(childPath);
  if (isWindows) {
    pParent = pParent.toLowerCase();
    pChild = pChild.toLowerCase();
  }
  const relative = path.relative(pParent, pChild);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export async function createFile(workspacePath: string, targetFilePath: string) {
  const wsRoot = path.resolve(workspacePath);
  const resolved = resolveWorkspacePath(wsRoot, targetFilePath);
  
  if (!isPathInside(resolved, wsRoot)) {
    throw new Error('Access denied: Path is outside the workspace root.');
  }

  try {
    await fs.access(resolved);
    throw new Error('File already exists.');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }

  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, '');
}

export async function createDirectory(workspacePath: string, targetDirPath: string) {
  const wsRoot = path.resolve(workspacePath);
  const resolved = resolveWorkspacePath(wsRoot, targetDirPath);
  
  if (!isPathInside(resolved, wsRoot)) {
    throw new Error('Access denied: Path is outside the workspace root.');
  }

  try {
    const stats = await fs.stat(resolved);
    if (stats.isDirectory()) {
      throw new Error('Directory already exists.');
    } else {
      throw new Error('A file with the same name already exists.');
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }

  await fs.mkdir(resolved, { recursive: true });
}

export async function deletePath(workspacePath: string, targetPath: string) {
  const wsRoot = path.resolve(workspacePath);
  const resolved = resolveWorkspacePath(wsRoot, targetPath);
  
  if (!isPathInside(resolved, wsRoot)) {
    throw new Error('Access denied: Path is outside the workspace root.');
  }

  await fs.rm(resolved, { recursive: true, force: true });
}

export async function renamePath(workspacePath: string, oldPath: string, newPath: string) {
  const wsRoot = path.resolve(workspacePath);
  const resolvedOld = resolveWorkspacePath(wsRoot, oldPath);
  const resolvedNew = resolveWorkspacePath(wsRoot, newPath);
  
  if (!isPathInside(resolvedOld, wsRoot) || !isPathInside(resolvedNew, wsRoot)) {
    throw new Error('Access denied: Path is outside the workspace root.');
  }

  // Support case-only renaming on Windows
  if (resolvedOld.toLowerCase() !== resolvedNew.toLowerCase()) {
    try {
      await fs.access(resolvedNew);
      throw new Error('Destination already exists.');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  await fs.rename(resolvedOld, resolvedNew);
}

export async function readWorkspaceFile(workspacePath: string, targetFilePath: string): Promise<string> {
  const wsRoot = path.resolve(workspacePath);
  const resolved = resolveWorkspacePath(wsRoot, targetFilePath);
  
  if (!isPathInside(resolved, wsRoot) && resolved !== wsRoot) {
    throw new Error('Access denied: Path is outside the workspace root.');
  }
  
  return await fs.readFile(resolved, 'utf8');
}

export async function writeWorkspaceFile(workspacePath: string, targetFilePath: string, content: string): Promise<void> {
  const wsRoot = path.resolve(workspacePath);
  const resolved = resolveWorkspacePath(wsRoot, targetFilePath);

  if (!isPathInside(resolved, wsRoot) && resolved !== wsRoot) {
    throw new Error('Access denied: Path is outside the workspace root.');
  }

  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, content, 'utf8');
}

