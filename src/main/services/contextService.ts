import fs from 'node:fs/promises';
import path from 'node:path';
import type { ProjectContext } from '../../shared/types.js';
import { readState } from './storageService.js';

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getTechStack(workspacePath: string): Promise<string> {
  const pkgPath = path.join(workspacePath, 'package.json');
  
  // A. Spring Boot (Java Maven or Gradle) Check
  if (await fileExists(path.join(workspacePath, 'pom.xml'))) {
    try {
      const pom = await fs.readFile(path.join(workspacePath, 'pom.xml'), 'utf8');
      const isSpring = pom.includes('spring-boot');
      return `Project Type: Spring Boot (Java Maven detected)\nBuild Config: pom.xml\nSpring Boot: ${isSpring ? 'Yes' : 'No'}`;
    } catch {
      return 'Java Maven Project (pom.xml detected)';
    }
  }

  if (await fileExists(path.join(workspacePath, 'build.gradle'))) {
    try {
      const gradle = await fs.readFile(path.join(workspacePath, 'build.gradle'), 'utf8');
      const isSpring = gradle.includes('spring-boot') || gradle.includes('org.springframework.boot');
      return `Project Type: Spring Boot (Java Gradle detected)\nBuild Config: build.gradle\nSpring Boot: ${isSpring ? 'Yes' : 'No'}`;
    } catch {
      return 'Java Gradle Project (build.gradle detected)';
    }
  }

  // B. Python Check
  const isPythonReq = await fileExists(path.join(workspacePath, 'requirements.txt'));
  const isPythonPyproject = await fileExists(path.join(workspacePath, 'pyproject.toml'));
  const isPythonPipfile = await fileExists(path.join(workspacePath, 'Pipfile'));
  const isPythonSetup = await fileExists(path.join(workspacePath, 'setup.py'));
  if (isPythonReq || isPythonPyproject || isPythonPipfile || isPythonSetup) {
    const configFiles: string[] = [];
    if (isPythonReq) configFiles.push('requirements.txt');
    if (isPythonPyproject) configFiles.push('pyproject.toml');
    if (isPythonPipfile) configFiles.push('Pipfile');
    if (isPythonSetup) configFiles.push('setup.py');
    return `Project Type: Python Project\nConfiguration detected: ${configFiles.join(', ')}`;
  }

  // C. Rust & Go Check
  if (await fileExists(path.join(workspacePath, 'Cargo.toml'))) {
    return 'Project Type: Rust Project (Cargo.toml detected)';
  }
  if (await fileExists(path.join(workspacePath, 'go.mod'))) {
    return 'Project Type: Go Project (go.mod detected)';
  }

  if (!(await fileExists(pkgPath))) {
    const hasIndexHtml = await fileExists(path.join(workspacePath, 'index.html'));
    const hasSrcIndexHtml = await fileExists(path.join(workspacePath, 'src', 'index.html'));
    const hasPublicIndexHtml = await fileExists(path.join(workspacePath, 'public', 'index.html'));
    
    if (hasIndexHtml || hasSrcIndexHtml || hasPublicIndexHtml) {
      return 'Project Type: Pure HTML/CSS (index.html detected)\nArchitecture: Static Frontend (No Node.js package.json)';
    }
    return 'Project Type: Generic or unknown technology stack';
  }

  // D. Node.js & modern frameworks check
  try {
    const raw = await fs.readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(raw);
    const parts: string[] = [];

    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    
    // Framework detectors
    const frameworkTags: string[] = [];
    if (deps['next']) {
      frameworkTags.push('Next.js');
    } else if (deps['@nestjs/core'] || await fileExists(path.join(workspacePath, 'nest-cli.json'))) {
      frameworkTags.push('NestJS');
    } else if (deps['express']) {
      frameworkTags.push('Express');
    } else if (deps['react']) {
      frameworkTags.push('React');
    }

    if (deps['vite'] || await fileExists(path.join(workspacePath, 'vite.config.ts')) || await fileExists(path.join(workspacePath, 'vite.config.js'))) {
      frameworkTags.push('Vite');
    }

    const projectType = frameworkTags.length > 0 ? frameworkTags.join(' + ') : 'Node.js / JavaScript';

    parts.push(`Project Type: ${projectType}`);
    if (pkg.name) parts.push(`Project Name: ${pkg.name}`);
    if (pkg.version) parts.push(`Version: ${pkg.version}`);
    if (pkg.type) parts.push(`Module Type: ${pkg.type}`);

    const depNames = Object.keys(pkg.dependencies || {});
    if (depNames.length > 0) {
      parts.push(`Dependencies: ${depNames.join(', ')}`);
    }

    const devDepNames = Object.keys(pkg.devDependencies || {});
    if (devDepNames.length > 0) {
      parts.push(`DevDependencies: ${devDepNames.join(', ')}`);
    }

    const scripts = Object.keys(pkg.scripts || {});
    if (scripts.length > 0) {
      parts.push(`Scripts: ${scripts.join(', ')}`);
    }

    return parts.join('\n');
  } catch (error) {
    return `Error parsing package.json: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function getFolderStructure(workspacePath: string, excludeFolders?: string[]): Promise<string> {
  const defaults = ['.git', 'node_modules', 'dist', '.vite', '.output', '.next', 'out', 'build', '.gemini'];
  const ignoreDirs = new Set(excludeFolders || defaults);
  const maxDepth = 3;

  async function traverse(currentDir: string, depth: number, prefix: string): Promise<string[]> {
    if (depth > maxDepth) return [];
    
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      // Sort: directories first, then files
      entries.sort((first, second) => {
        if (first.isDirectory() && !second.isDirectory()) return -1;
        if (!first.isDirectory() && second.isDirectory()) return 1;
        return first.name.localeCompare(second.name);
      });

      let lines: string[] = [];
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (ignoreDirs.has(entry.name)) continue;

        const isLast = i === entries.length - 1;
        const pointer = isLast ? '└── ' : '├── ';
        lines.push(`${prefix}${pointer}${entry.name}`);

        if (entry.isDirectory()) {
          const nextPrefix = prefix + (isLast ? '    ' : '│   ');
          const subLines = await traverse(path.join(currentDir, entry.name), depth + 1, nextPrefix);
          lines = lines.concat(subLines);
        }
      }
      return lines;
    } catch {
      return [];
    }
  }

  const rootName = path.basename(workspacePath) || 'root';
  const treeLines = await traverse(workspacePath, 1, '');
  return [rootName, ...treeLines].join('\n');
}

async function getCodingRules(workspacePath: string): Promise<string> {
  const rulesFiles = [
    { name: '.prettierrc.json', parser: 'json' },
    { name: '.prettierrc', parser: 'yaml/json' },
    { name: 'eslint.config.js', parser: 'js' },
    { name: '.eslintrc.json', parser: 'json' },
    { name: '.editorconfig', parser: 'ini' }
  ];

  const foundRules: string[] = [];
  for (const file of rulesFiles) {
    const filePath = path.join(workspacePath, file.name);
    if (await fileExists(filePath)) {
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        // Truncate if too long to prevent token stuffing
        const content = raw.length > 800 ? raw.slice(0, 800) + '\n... (truncated)' : raw;
        foundRules.push(`--- ${file.name} ---\n${content}`);
      } catch (err) {
        foundRules.push(`--- ${file.name} ---\nCould not read: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  if (foundRules.length === 0) {
    return 'No standard linting or formatting rule files found in root.';
  }

  return foundRules.join('\n\n');
}

async function getProjectMemory(workspacePath: string): Promise<string> {
  const memoryCandidates = ['MEMORY.md', 'README.md', 'TODO.md'];
  for (const name of memoryCandidates) {
    const filePath = path.join(workspacePath, name);
    if (await fileExists(filePath)) {
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        // Truncate to avoid token stuffing
        const content = raw.length > 1500 ? raw.slice(0, 1500) + '\n\n... (context truncated)' : raw;
        return `Source: ${name}\n\n${content}`;
      } catch {
        // Continue to next candidate if read fails
      }
    }
  }
  return 'No project memory file (MEMORY.md or README.md) found.';
}

async function getEnvExample(workspacePath: string): Promise<string> {
  const envCandidates = ['.env.example', '.env.local.example', '.env.sample', 'env.example', '.env.dev.example'];
  for (const name of envCandidates) {
    const filePath = path.join(workspacePath, name);
    if (await fileExists(filePath)) {
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        const lines = raw.split('\n');
        const cleanLines = lines.map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) {
            return line;
          }
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            const valPart = trimmed.slice(eqIdx + 1).trim();
            const hashIdx = valPart.indexOf('#');
            const comment = hashIdx !== -1 ? ' ' + valPart.slice(hashIdx) : '';
            return `${key}=xxxxxx${comment}`;
          }
          return line;
        });

        const content = cleanLines.join('\n');
        return content.length > 1000 ? content.slice(0, 1000) + '\n... (truncated)' : content;
      } catch {
        // skip
      }
    }
  }
  return 'No environment example file (.env.example) found in workspace root.';
}

async function getKeyModules(workspacePath: string, excludeFolders?: string[]): Promise<string> {
  const defaults = ['node_modules', 'dist', 'build', '.git', '.vite', '.next', '.gemini', 'out'];
  const ignoreDirs = new Set(excludeFolders || defaults);
  const importantDirs = ['routes', 'api', 'services', 'controllers', 'models', 'components', 'pages', 'app'];
  const importantExts = new Set(['.ts', '.tsx', '.js', '.jsx']);
  const maxFiles = 15;
  const foundFiles: { relPath: string; type: string }[] = [];

  async function scan(currentDir: string, depth: number) {
    if (depth > 4 || foundFiles.length >= maxFiles) return;

    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (foundFiles.length >= maxFiles) return;

        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(workspacePath, fullPath);

        if (entry.isDirectory()) {
          if (ignoreDirs.has(entry.name)) {
            continue;
          }
          const isImportantDir = importantDirs.includes(entry.name.toLowerCase()) || depth > 1;
          if (isImportantDir) {
            await scan(fullPath, depth + 1);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (importantExts.has(ext)) {
            const lowerPath = relPath.toLowerCase();
            let type = 'OtherModule';
            if (lowerPath.includes('route') || lowerPath.includes('api')) {
              type = 'Route/API';
            } else if (lowerPath.includes('service')) {
              type = 'Service';
            } else if (lowerPath.includes('controller')) {
              type = 'Controller';
            } else if (lowerPath.includes('model')) {
              type = 'Data Model';
            } else if (lowerPath.includes('component')) {
              type = 'UI Component';
            } else if (lowerPath.includes('page')) {
              type = 'Page View';
            }

            const isTarget = importantDirs.some(d => lowerPath.split(path.sep).includes(d)) ||
                             entry.name.includes('.controller.') ||
                             entry.name.includes('.service.') ||
                             entry.name.includes('.route.') ||
                             entry.name.includes('.component.');

            if (isTarget) {
              foundFiles.push({ relPath, type });
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  await scan(workspacePath, 1);

  if (foundFiles.length === 0) {
    return 'No prominent Routes, APIs, Services, or Components found in standard directories.';
  }

  const lines = foundFiles.map(
    (file, idx) => `${idx + 1}. [${file.type}] ${file.relPath}`
  );
  return lines.join('\n');
}

export async function generateProjectContext(workspacePath: string): Promise<ProjectContext> {
  let excludeFolders = ['.git', 'node_modules', 'dist', '.vite', '.output', '.next', 'out', 'build', '.gemini'];
  try {
    const state = await readState();
    const excludeSetting = state.appSettings.find(s => s.key === 'context.excludeFolders');
    if (excludeSetting && typeof excludeSetting.value === 'string') {
      excludeFolders = excludeSetting.value.split(',').map(s => s.trim()).filter(Boolean);
    }
  } catch (err) {
    console.error('Failed to read context.excludeFolders setting, using defaults:', err);
  }

  const [techStack, folderStructure, codingRules, projectMemory, envExample, keyModules] = await Promise.all([
    getTechStack(workspacePath),
    getFolderStructure(workspacePath, excludeFolders),
    getCodingRules(workspacePath),
    getProjectMemory(workspacePath),
    getEnvExample(workspacePath),
    getKeyModules(workspacePath, excludeFolders)
  ]);

  return {
    techStack,
    folderStructure,
    codingRules,
    projectMemory,
    envExample,
    keyModules,
    updatedAt: Date.now()
  };
}
