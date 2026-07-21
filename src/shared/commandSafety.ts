import type { CommandCategory, CommandSafetyReview, DangerousCommandFinding } from './types.js';

type Detector = {
  id: string;
  severity: DangerousCommandFinding['severity'];
  pattern: string;
  message: string;
  matches: (command: string, normalized: string) => boolean;
};

const includesAny = (normalized: string, patterns: string[]) =>
  patterns.some((pattern) => normalized.includes(pattern));

const detectors: Detector[] = [
  {
    id: 'rm-rf',
    severity: 'block',
    pattern: 'rm -rf',
    message: 'Recursively deletes files or folders without normal recovery options.',
    matches: (_command, normalized) => normalized.includes('rm -rf') || normalized.includes('rm -fr')
  },
  {
    id: 'windows-del-recursive',
    severity: 'block',
    pattern: 'del /s',
    message: 'Recursively deletes files on Windows.',
    matches: (_command, normalized) => normalized.includes('del /s')
  },
  {
    id: 'windows-rmdir-recursive',
    severity: 'block',
    pattern: 'rmdir /s',
    message: 'Recursively removes directories on Windows.',
    matches: (_command, normalized) => normalized.includes('rmdir /s') || normalized.includes('rd /s')
  },
  {
    id: 'format-disk',
    severity: 'block',
    pattern: 'format',
    message: 'Can format a drive or volume.',
    matches: (_command, normalized) => normalized.startsWith('format ') || normalized.includes(' format ')
  },
  {
    id: 'diskpart',
    severity: 'block',
    pattern: 'diskpart',
    message: 'Can modify disks, partitions, and volumes.',
    matches: (_command, normalized) => normalized.includes('diskpart')
  },
  {
    id: 'powershell-encoded',
    severity: 'block',
    pattern: 'powershell -encodedcommand',
    message: 'Encoded PowerShell commands hide their actual behavior.',
    matches: (_command, normalized) =>
      normalized.includes('powershell') && (normalized.includes('-encodedcommand') || normalized.includes(' -enc '))
  },
  {
    id: 'curl-pipe-shell',
    severity: 'block',
    pattern: 'curl | shell',
    message: 'Downloads and executes remote code in a shell.',
    matches: (_command, normalized) =>
      normalized.includes('curl') &&
      normalized.includes('|') &&
      includesAny(normalized, [' sh', ' bash', ' powershell', ' pwsh', ' cmd'])
  },
  {
    id: 'wget-pipe-shell',
    severity: 'block',
    pattern: 'wget | shell',
    message: 'Downloads and executes remote code in a shell.',
    matches: (_command, normalized) =>
      normalized.includes('wget') &&
      normalized.includes('|') &&
      includesAny(normalized, [' sh', ' bash', ' powershell', ' pwsh', ' cmd'])
  },
  {
    id: 'git-reset-hard',
    severity: 'danger',
    pattern: 'git reset --hard',
    message: 'Discards local tracked-file changes.',
    matches: (_command, normalized) => normalized.includes('git reset --hard')
  },
  {
    id: 'git-clean-force',
    severity: 'danger',
    pattern: 'git clean -fd',
    message: 'Deletes untracked files and directories.',
    matches: (_command, normalized) => normalized.includes('git clean -fd') || normalized.includes('git clean -df')
  },
  {
    id: 'delete-node-modules',
    severity: 'review',
    pattern: 'delete node_modules',
    message: 'Deletes dependency folders and can break the workspace until reinstall.',
    matches: (_command, normalized) =>
      normalized.includes('node_modules') && includesAny(normalized, ['rm ', 'del ', 'rmdir ', 'rd ', 'remove-item'])
  },
  {
    id: 'env-exfiltration',
    severity: 'block',
    pattern: 'environment exfiltration',
    message: 'May expose environment variables or secrets to a network endpoint.',
    matches: (_command, normalized) =>
      includesAny(normalized, ['env | curl', 'printenv | curl', 'set | curl', 'get-childitem env: |', '$env:']) &&
      includesAny(normalized, ['curl', 'wget', 'invoke-webrequest', 'irm '])
  },
  {
    id: 'unknown-npm-script',
    severity: 'review',
    pattern: 'npm run unknown script',
    message: 'npm scripts can execute arbitrary project-defined commands.',
    matches: (_command, normalized) =>
      normalized.startsWith('npm run ') &&
      !includesAny(normalized, ['npm run build', 'npm run test', 'npm run lint', 'npm run typecheck', 'npm run dev'])
  }
];

export function categorizeCommand(command: string): CommandCategory {
  const normalized = command.trim().toLowerCase();
  if (!normalized) {
    return 'unknown';
  }

  if (includesAny(normalized, ['rm ', 'del ', 'rmdir ', 'rd ', 'remove-item', 'git clean', 'git reset --hard'])) {
    return 'delete';
  }

  if (normalized.startsWith('git ')) {
    return 'git';
  }

  if (includesAny(normalized, ['npm install', 'pnpm install', 'yarn add', 'yarn install'])) {
    return 'package-install';
  }

  if (
    includesAny(normalized, [
      'npm test',
      'npm run test',
      'npm run build',
      'npm run lint',
      'npm run typecheck',
      'pnpm test',
      'yarn test'
    ])
  ) {
    return 'build-test';
  }

  if (includesAny(normalized, ['curl ', 'wget ', 'invoke-webrequest', 'irm '])) {
    return 'network';
  }

  if (includesAny(normalized, ['echo ', 'new-item', 'set-content', 'out-file', 'copy ', 'move ', 'mkdir '])) {
    return 'file-write';
  }

  if (includesAny(normalized, ['shutdown', 'taskkill', 'diskpart', 'format '])) {
    return 'system';
  }

  if (
    ['pwd', 'ls', 'dir', 'git status', 'git diff'].some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix} `)
    )
  ) {
    return 'safe-read';
  }

  return 'unknown';
}

export function detectDangerousCommand(command: string): CommandSafetyReview {
  const normalized = command.trim().toLowerCase().replace(/\s+/g, ' ');
  const findings = detectors
    .filter((detector) => detector.matches(command, normalized))
    .map(({ id, severity, pattern, message }) => ({ id, severity, pattern, message }));
  const category = categorizeCommand(command);
  const blocked = findings.some((finding) => finding.severity === 'block');
  const risky =
    blocked ||
    category === 'delete' ||
    category === 'system' ||
    findings.some((finding) => finding.severity === 'danger' || finding.severity === 'review');

  return {
    command,
    category,
    findings,
    safe: !risky && (category === 'safe-read' || category === 'build-test'),
    risky,
    blocked
  };
}
