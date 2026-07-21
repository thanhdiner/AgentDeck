import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GitWorkspaceStatus } from '../../shared/types.js';
import { sanitizeCwd } from './terminalService.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import { callLLMRaw, LLMSettings } from './projectInitService.js';

const execFileAsync = promisify(execFile);

async function isGitRepository(cwd: string) {
  try {
    const result = await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], { cwd, windowsHide: true });
    return result.stdout.trim() === 'true';
  } catch {
    return false;
  }
}

async function readDiffStat(cwd: string) {
  const [staged, unstaged] = await Promise.all([
    execFileAsync('git', ['diff', '--cached', '--stat'], { cwd, windowsHide: true }),
    execFileAsync('git', ['diff', '--stat'], { cwd, windowsHide: true })
  ]);

  return [staged.stdout.trim(), unstaged.stdout.trim()].filter(Boolean).join('\n');
}

async function getGitBranch(cwd: string): Promise<string | null> {
  try {
    const result = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, windowsHide: true });
    return result.stdout.trim();
  } catch {
    return null;
  }
}

function parseGitNumstatPath(gitPath: string): string {
  let cleaned = gitPath.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
    cleaned = cleaned.replace(/\\"/g, '"');
  }
  
  // Pattern 1: {old => new}
  const match = cleaned.match(/(.*?)\{(.*?) => (.*?)\}(.*)/);
  if (match) {
    const [, prefix, , suffix, rest] = match;
    return `${prefix}${suffix}${rest}`.replace(/\/\/+/g, '/');
  }
  // Pattern 2: old => new
  if (cleaned.includes(' => ')) {
    const parts = cleaned.split(' => ');
    return parts[1].trim();
  }
  return cleaned;
}

async function getGitNumstat(cwd: string): Promise<Record<string, { additions: number; deletions: number }>> {
  const numstatMap: Record<string, { additions: number; deletions: number }> = {};
  try {
    const result = await execFileAsync('git', ['diff', 'HEAD', '--numstat'], { cwd, windowsHide: true });
    const lines = result.stdout.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        const additionsStr = parts[0];
        const deletionsStr = parts[1];
        const rawPath = parts.slice(2).join(' ');
        
        const additions = additionsStr === '-' ? 0 : parseInt(additionsStr, 10) || 0;
        const deletions = deletionsStr === '-' ? 0 : parseInt(deletionsStr, 10) || 0;
        
        const parsedPath = parseGitNumstatPath(rawPath);
        numstatMap[parsedPath] = { additions, deletions };
      }
    }
  } catch (err) {
    console.error('Failed to run git diff --numstat:', err);
  }
  return numstatMap;
}

async function countFileLines(cwd: string, relPath: string): Promise<number> {
  try {
    const fullPath = path.resolve(cwd, relPath);
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) return 0;
    const content = await fs.readFile(fullPath, 'utf-8');
    if (!content) return 0;
    return content.split(/\r?\n/).length;
  } catch {
    return 0;
  }
}

export async function getGitWorkspaceStatus(workspacePath: string): Promise<GitWorkspaceStatus> {
  const cwd = sanitizeCwd(workspacePath);

  try {
    const isRepo = await isGitRepository(cwd);
    if (!isRepo) {
      return {
        isRepo: false,
        changedFiles: [],
        statusText: 'Not a Git repository.',
        diffStat: '',
        error: 'Not a Git repository.',
        branch: null
      };
    }

    const [status, diffStat, branch, numstatMap] = await Promise.all([
      execFileAsync('git', ['status', '--short'], { cwd, windowsHide: true }),
      readDiffStat(cwd),
      getGitBranch(cwd),
      getGitNumstat(cwd)
    ]);
    const statusText = status.stdout.trim();
    const changedFiles = statusText ? statusText.split(/\r?\n/).filter(Boolean) : [];

    const numstat: Record<string, { additions: number; deletions: number }> = {};
    Object.assign(numstat, numstatMap);

    for (const fileLine of changedFiles) {
      const code = fileLine.slice(0, 2);
      let pathPart = fileLine.slice(2).trim();
      if (pathPart.startsWith('"') && pathPart.endsWith('"')) {
        pathPart = pathPart.slice(1, -1).replace(/\\"/g, '"');
      }

      if (code.startsWith('R') || pathPart.includes(' -> ')) {
        const arrowIndex = pathPart.indexOf(' -> ');
        if (arrowIndex !== -1) {
          pathPart = pathPart.slice(arrowIndex + 4).trim();
          if (pathPart.startsWith('"') && pathPart.endsWith('"')) {
            pathPart = pathPart.slice(1, -1).replace(/\\"/g, '"');
          }
        }
      }

      if (code === '??') {
        const linesCount = await countFileLines(cwd, pathPart);
        numstat[pathPart] = { additions: linesCount, deletions: 0 };
      }
    }

    return {
      isRepo: true,
      changedFiles,
      statusText: statusText || 'Working tree clean.',
      diffStat,
      error: null,
      branch,
      numstat
    };
  } catch (error) {
    return {
      isRepo: false,
      changedFiles: [],
      statusText: 'Git status failed.',
      diffStat: '',
      error: error instanceof Error ? error.message : 'Git status failed.',
      branch: null
    };
  }
}

export async function createGitCheckpoint(workspacePath: string) {
  const cwd = sanitizeCwd(workspacePath);
  const status = await getGitWorkspaceStatus(cwd);
  if (!status.isRepo) {
    throw new Error(status.error ?? 'Not a Git repository.');
  }

  if (status.changedFiles.length === 0) {
    return 'Working tree clean.';
  }

  const message = `AgentDeck checkpoint ${new Date().toISOString()}`;
  await execFileAsync('git', ['add', '-A'], { cwd, windowsHide: true });
  await execFileAsync('git', ['commit', '-m', message], { cwd, windowsHide: true });
  const after = await getGitWorkspaceStatus(cwd);

  return [
    `Checkpoint commit created: ${message}`,
    '',
    'Captured changes:',
    status.statusText,
    status.diffStat,
    '',
    'After checkpoint:',
    after.statusText
  ]
    .filter(Boolean)
    .join('\n');
}

export async function getGitFileDiff(workspacePath: string, filePath: string, contextLines?: number): Promise<string> {
  const cwd = sanitizeCwd(workspacePath);
  try {
    const isRepo = await isGitRepository(cwd);
    if (!isRepo) {
      throw new Error('Not a Git repository.');
    }
    
    const resolvedPath = path.resolve(cwd, filePath);
    const relativePath = path.relative(cwd, resolvedPath).replace(/\\/g, '/');

    const statusResult = await execFileAsync('git', ['status', '--porcelain', '--', relativePath], { cwd, windowsHide: true });
    const statusLine = statusResult.stdout.trim();

    if (statusLine.startsWith('??')) {
      try {
        const content = await fs.readFile(resolvedPath, 'utf-8');
        const lines = content.split(/\r?\n/);
        const header = [
          `diff --git a/${relativePath} b/${relativePath}`,
          `new file mode 100644`,
          `--- /dev/null`,
          `+++ b/${relativePath}`,
          `@@ -0,0 +1,${lines.length} @@`
        ];
        const body = lines.map(line => `+${line}`);
        return [...header, ...body].join('\n');
      } catch (err) {
        return `Error reading untracked file: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    const args = ['diff', 'HEAD'];
    if (contextLines !== undefined) {
      args.push(`-U${contextLines}`);
    }
    args.push('--', relativePath);

    const result = await execFileAsync('git', args, { cwd, windowsHide: true });
    return result.stdout;
  } catch (error) {
    throw error;
  }
}

export async function discardGitFileChanges(workspacePath: string, filePath: string): Promise<void> {
  const cwd = sanitizeCwd(workspacePath);
  try {
    const isRepo = await isGitRepository(cwd);
    if (!isRepo) {
      throw new Error('Not a Git repository.');
    }

    const resolvedPath = path.resolve(cwd, filePath);
    const relativePath = path.relative(cwd, resolvedPath).replace(/\\/g, '/');

    const statusResult = await execFileAsync('git', ['status', '--porcelain', '--', relativePath], { cwd, windowsHide: true });
    const statusLine = statusResult.stdout.trim();

    if (statusLine.startsWith('??')) {
      await fs.rm(resolvedPath, { force: true });
    } else {
      await execFileAsync('git', ['checkout', 'HEAD', '--', relativePath], { cwd, windowsHide: true });
    }
  } catch (error) {
    throw error;
  }
}

export async function discardAllGitChanges(workspacePath: string): Promise<void> {
  const cwd = sanitizeCwd(workspacePath);
  try {
    const isRepo = await isGitRepository(cwd);
    if (!isRepo) {
      throw new Error('Not a Git repository.');
    }

    await execFileAsync('git', ['checkout', 'HEAD', '--', '.'], { cwd, windowsHide: true });
    await execFileAsync('git', ['clean', '-fd'], { cwd, windowsHide: true });
  } catch (error) {
    throw error;
  }
}

export async function commitGitChanges(workspacePath: string, filePaths: string[], message: string): Promise<void> {
  const cwd = sanitizeCwd(workspacePath);
  try {
    const isRepo = await isGitRepository(cwd);
    if (!isRepo) {
      throw new Error('Not a Git repository.');
    }

    for (const filePath of filePaths) {
      const resolvedPath = path.resolve(cwd, filePath);
      const relativePath = path.relative(cwd, resolvedPath).replace(/\\/g, '/');
      await execFileAsync('git', ['add', '--', relativePath], { cwd, windowsHide: true });
    }

    await execFileAsync('git', ['commit', '-m', message], { cwd, windowsHide: true });
  } catch (error) {
    throw error;
  }
}

export async function revertGitHunk(
  workspacePath: string,
  filePath: string,
  hunkHeader: string,
  hunkLines: string[]
): Promise<void> {
  const cwd = sanitizeCwd(workspacePath);
  try {
    const isRepo = await isGitRepository(cwd);
    if (!isRepo) {
      throw new Error('Not a Git repository.');
    }

    const resolvedPath = path.resolve(cwd, filePath);
    const relativePath = path.relative(cwd, resolvedPath).replace(/\\/g, '/');

    // Re-construct a valid unified diff patch for this single hunk
    const patchLines = [
      `diff --git a/${relativePath} b/${relativePath}`,
      `--- a/${relativePath}`,
      `+++ b/${relativePath}`,
      hunkHeader,
      ...hunkLines
    ];
    const patchContent = patchLines.join('\n') + '\n';

    // Safe writing to a temp patch file
    const tempPatchPath = path.resolve(
      cwd,
      `.temp-revert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.patch`
    );
    try {
      await fs.writeFile(tempPatchPath, patchContent, 'utf-8');
      await execFileAsync('git', ['apply', '--reverse', tempPatchPath], { cwd, windowsHide: true });
    } finally {
      await fs.rm(tempPatchPath, { force: true });
    }
  } catch (error) {
    throw error;
  }
}

export async function generateCommitMessage(
  workspacePath: string,
  filePaths: string[],
  settings: LLMSettings
): Promise<string> {
  const cwd = sanitizeCwd(workspacePath);
  if (!filePaths || filePaths.length === 0) {
    throw new Error('Vui lòng chọn ít nhất một tệp thay đổi để tạo thông điệp commit.');
  }

  // 1. Thu thập diff của các tệp tin được chọn
  let aggregatedDiff = '';
  const maxDiffLength = 15000; // Giới hạn độ dài để tránh quá tải token

  for (const filePath of filePaths) {
    try {
      const fileDiff = await getGitFileDiff(workspacePath, filePath);
      if (fileDiff) {
        aggregatedDiff += `\n--- FILE: ${filePath} ---\n${fileDiff}\n`;
        if (aggregatedDiff.length > maxDiffLength) {
          aggregatedDiff = aggregatedDiff.slice(0, maxDiffLength) + '\n... [Diff bị cắt bớt vì quá dài] ...\n';
          break;
        }
      }
    } catch (err) {
      console.error(`Lỗi khi lấy diff cho file ${filePath}:`, err);
    }
  }

  if (!aggregatedDiff.trim()) {
    throw new Error('Không tìm thấy thay đổi nào (diff trống) trong các file đã chọn.');
  }

  // 2. Xây dựng prompts
  const systemPrompt = `You are an expert developer. Generate a clean, short, and concise Git commit message in English based on the provided diff of file changes.

You MUST follow the Conventional Commits convention:
- Use one of the prefixes: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
  Examples:
  - feat: add feature X
  - fix: resolve issue Y
  - refactor: restructure code for readability
- The first line (subject) should be very concise, ideally under 60 characters.
- Write the commit message in English. Keep it moderately short.
- If there are multiple key changes, write a bulleted list in the body after a blank line. If the changes are small, just write a single subject line.
- Respond ONLY with the raw commit message. Do NOT wrap it in markdown code blocks (\`\`\` or \`\`\`git) and do NOT add any conversational introduction/outro (like "Here is your commit message:").`;

  const userPrompt = `Generate a commit message for the following changes:\n\n${aggregatedDiff}`;

  try {
    const response = await callLLMRaw(systemPrompt, userPrompt, settings, false);
    
    // Clean up response if the model wrapped it in markdown code block or added extra formatting
    let cleanMsg = response.trim();
    if (cleanMsg.startsWith('```')) {
      const firstLineEnd = cleanMsg.indexOf('\n');
      if (firstLineEnd !== -1) {
        cleanMsg = cleanMsg.substring(firstLineEnd + 1);
      }
      if (cleanMsg.endsWith('```')) {
        cleanMsg = cleanMsg.substring(0, cleanMsg.length - 3);
      }
      cleanMsg = cleanMsg.trim();
    }
    
    return cleanMsg;
  } catch (error) {
    console.error('Failed to generate commit message via LLM:', error);
    throw new Error(`AI không thể tạo commit message: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function gitFetch(workspacePath: string): Promise<string> {
  const cwd = sanitizeCwd(workspacePath);
  try {
    const isRepo = await isGitRepository(cwd);
    if (!isRepo) throw new Error('Not a Git repository.');
    const result = await execFileAsync('git', ['fetch'], { cwd, windowsHide: true, timeout: 30000 });
    return result.stdout.trim() || result.stderr.trim() || 'Fetch completed.';
  } catch (error) {
    throw error;
  }
}

export async function gitPull(workspacePath: string): Promise<string> {
  const cwd = sanitizeCwd(workspacePath);
  try {
    const isRepo = await isGitRepository(cwd);
    if (!isRepo) throw new Error('Not a Git repository.');
    const result = await execFileAsync('git', ['pull'], { cwd, windowsHide: true, timeout: 30000 });
    return result.stdout.trim() || result.stderr.trim() || 'Pull completed.';
  } catch (error) {
    throw error;
  }
}

export async function gitPush(workspacePath: string): Promise<string> {
  const cwd = sanitizeCwd(workspacePath);
  try {
    const isRepo = await isGitRepository(cwd);
    if (!isRepo) throw new Error('Not a Git repository.');
    const result = await execFileAsync('git', ['push'], { cwd, windowsHide: true, timeout: 30000 });
    return result.stdout.trim() || result.stderr.trim() || 'Push completed.';
  } catch (error) {
    throw error;
  }
}

