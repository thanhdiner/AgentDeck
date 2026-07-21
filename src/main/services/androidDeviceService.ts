// Đã đọc AGENTS.md
import { execFile, exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import type { AndroidDevice, AndroidDeviceStatus } from '../../shared/types.js';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

let cachedAdbPath: string | null = null;

async function getAdbPath(): Promise<string> {
  if (cachedAdbPath) return cachedAdbPath;

  // 1. Check if 'adb' is available on System PATH
  try {
    await execFileAsync('adb', ['version'], { timeout: 3000, windowsHide: true });
    cachedAdbPath = 'adb';
    return 'adb';
  } catch (err) {
    // Ignore and proceed
  }

  // 2. Check custom installation path
  const customPath = process.platform === 'win32'
    ? path.join(os.homedir(), '.agentdeck', 'platform-tools', 'adb.exe')
    : path.join(os.homedir(), '.agentdeck', 'platform-tools', 'adb');

  if (fs.existsSync(customPath)) {
    cachedAdbPath = customPath;
    return customPath;
  }

  // 3. Check common Android Sdk locations on Windows
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const commonPaths = [
      path.join(localAppData, 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
      path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
      'C:\\Android\\sdk\\platform-tools\\adb.exe',
      'C:\\Program Files (x86)\\Android\\android-sdk\\platform-tools\\adb.exe'
    ];

    for (const p of commonPaths) {
      try {
        if (fs.existsSync(p)) {
          cachedAdbPath = p;
          return p;
        }
      } catch {
        // Ignore
      }
    }
  }

  return 'adb';
}

export async function detectAdb(): Promise<{ adbPath?: string; version?: string; missing: boolean }> {
  try {
    const adbPath = await getAdbPath();
    const { stdout } = await execFileAsync(adbPath, ['version'], { timeout: 3000, windowsHide: true });
    const match = stdout.match(/Android Debug Bridge version ([\d.]+)/);
    const version = match ? match[1] : 'unknown';
    return { adbPath, version, missing: false };
  } catch (err) {
    return { missing: true };
  }
}

export async function listAndroidDevices(): Promise<AndroidDevice[]> {
  try {
    const adbPath = await getAdbPath();
    const { stdout } = await execFileAsync(adbPath, ['devices', '-l'], { timeout: 5000, windowsHide: true });
    
    const lines = stdout.split(/\r?\n/);
    const devices: AndroidDevice[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('List of devices attached') || trimmed.startsWith('*')) {
        continue;
      }

      // Format: <deviceId> <status> [product:<prod>] [model:<model>] [device:<dev>] [transport_id:<id>]
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const id = parts[0];
        const status = parts[1] as AndroidDeviceStatus;
        const deviceObj: AndroidDevice = { id, status };

        for (let i = 2; i < parts.length; i++) {
          const keyVal = parts[i];
          const colonIndex = keyVal.indexOf(':');
          if (colonIndex !== -1) {
            const key = keyVal.substring(0, colonIndex);
            const val = keyVal.substring(colonIndex + 1);
            if (key === 'model') {
              deviceObj.model = val.replace(/_/g, ' ');
            } else if (key === 'product') {
              deviceObj.product = val;
            } else if (key === 'device') {
              deviceObj.device = val;
            } else if (key === 'transport_id') {
              deviceObj.transportId = val;
            }
          }
        }
        devices.push(deviceObj);
      }
    }

    return devices;
  } catch (err) {
    console.error('Failed to list Android devices via ADB:', err);
    return [];
  }
}

function validateDeviceId(deviceId: string) {
  if (!deviceId || typeof deviceId !== 'string') {
    throw new Error('Invalid device ID');
  }
  if (!/^[a-zA-Z0-9_.:-]+$/.test(deviceId)) {
    throw new Error('Device ID contains illegal characters');
  }
}

function validatePort(port: number) {
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid port number. Port must be an integer between 1 and 65535.');
  }
}

export async function reversePort(deviceId: string, port: number): Promise<void> {
  validateDeviceId(deviceId);
  validatePort(port);

  // Safeguard: Check that the device exists in listed devices and status is 'device'
  const devices = await listAndroidDevices();
  const target = devices.find(d => d.id === deviceId);
  if (!target) {
    throw new Error(`Device ${deviceId} not found`);
  }
  if (target.status !== 'device') {
    throw new Error(`Device ${deviceId} is not ready (status: ${target.status})`);
  }

  const adbPath = await getAdbPath();
  const portStr = String(port);
  await execFileAsync(adbPath, ['-s', deviceId, 'reverse', `tcp:${portStr}`, `tcp:${portStr}`], {
    timeout: 5000,
    windowsHide: true
  });
}

export async function removeReversePort(deviceId: string, port: number): Promise<void> {
  validateDeviceId(deviceId);
  validatePort(port);

  const adbPath = await getAdbPath();
  const portStr = String(port);
  await execFileAsync(adbPath, ['-s', deviceId, 'reverse', '--remove', `tcp:${portStr}`], {
    timeout: 5000,
    windowsHide: true
  });
}

export async function listReversePorts(deviceId: string): Promise<number[]> {
  validateDeviceId(deviceId);
  
  // Safeguard: Check that the device exists in listed devices and status is 'device'
  const devices = await listAndroidDevices();
  const target = devices.find(d => d.id === deviceId);
  if (!target) {
    throw new Error(`Device ${deviceId} not found`);
  }
  if (target.status !== 'device') {
    return [];
  }

  try {
    const adbPath = await getAdbPath();
    const { stdout } = await execFileAsync(adbPath, ['-s', deviceId, 'reverse', '--list'], {
      timeout: 5000,
      windowsHide: true
    });

    const lines = stdout.split(/\r?\n/);
    const ports: number[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Format example: "R58N... tcp:3000 tcp:3000" or "(device) tcp:3000 tcp:3000"
      const matches = trimmed.match(/tcp:(\d+)/g);
      if (matches && matches.length > 0) {
        const portStr = matches[0].split(':')[1];
        const port = parseInt(portStr, 10);
        if (!isNaN(port) && !ports.includes(port)) {
          ports.push(port);
        }
      }
    }
    return ports;
  } catch (err) {
    console.error(`Failed to list reverse ports for ${deviceId}:`, err);
    return [];
  }
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    function get(currentUrl: string) {
      https.get(currentUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            get(redirectUrl);
            return;
          }
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download: Status Code ${res.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }
    get(url);
  });
}

export async function installAdb(): Promise<{ ok: boolean; error?: string }> {
  try {
    const agentDeckDir = path.join(os.homedir(), '.agentdeck');
    if (!fs.existsSync(agentDeckDir)) {
      fs.mkdirSync(agentDeckDir, { recursive: true });
    }

    const zipPath = path.join(agentDeckDir, 'platform-tools.zip');
    
    let downloadUrl = '';
    if (process.platform === 'win32') {
      downloadUrl = 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip';
    } else if (process.platform === 'darwin') {
      downloadUrl = 'https://dl.google.com/android/repository/platform-tools-latest-darwin.zip';
    } else {
      downloadUrl = 'https://dl.google.com/android/repository/platform-tools-latest-linux.zip';
    }

    // Download the ZIP file
    await downloadFile(downloadUrl, zipPath);

    // Extract the ZIP file
    let extractCmd = '';
    if (process.platform === 'win32') {
      extractCmd = `powershell.exe -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${agentDeckDir}' -Force"`;
    } else {
      extractCmd = `unzip -o "${zipPath}" -d "${agentDeckDir}"`;
    }
    await execAsync(extractCmd);

    // Clean up
    try {
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
      }
    } catch {
      // Ignore cleanup errors
    }

    // Invalidate cache
    cachedAdbPath = null;

    // Check if the newly installed adb is working
    const checkRes = await detectAdb();
    if (checkRes.missing) {
      return { ok: false, error: 'ADB installed but failed to execute.' };
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Unknown installation error.' };
  }
}

export async function captureScreenshot(deviceId: string): Promise<string> {
  validateDeviceId(deviceId);

  const adbPath = await getAdbPath();
  
  // Use exec-out to bypass terminal translation issues on Windows and stream binary safely
  const { stdout } = await execFileAsync(adbPath, ['-s', deviceId, 'exec-out', 'screencap', '-p'], {
    encoding: 'buffer',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 5000,
    windowsHide: true
  });

  return stdout.toString('base64');
}

let cachedScrcpyPath: string | null = null;

async function getScrcpyPath(): Promise<string | null> {
  if (cachedScrcpyPath && fs.existsSync(cachedScrcpyPath)) return cachedScrcpyPath;

  // Check custom installation path
  const customPath = process.platform === 'win32'
    ? path.join(os.homedir(), '.agentdeck', 'scrcpy', 'scrcpy.exe')
    : path.join(os.homedir(), '.agentdeck', 'scrcpy', 'scrcpy');

  if (fs.existsSync(customPath)) {
    cachedScrcpyPath = customPath;
    return customPath;
  }

  // Check system PATH
  try {
    const checkCmd = process.platform === 'win32' ? 'where.exe scrcpy' : 'which scrcpy';
    const { stdout } = await execAsync(checkCmd);
    const pathFound = stdout.trim().split(/\r?\n/)[0];
    if (pathFound && fs.existsSync(pathFound)) {
      cachedScrcpyPath = pathFound;
      return pathFound;
    }
  } catch {
    // Ignore
  }

  return null;
}

export async function detectScrcpy(): Promise<{ missing: boolean; scrcpyPath?: string }> {
  const scrcpyPath = await getScrcpyPath();
  return { missing: !scrcpyPath, scrcpyPath: scrcpyPath || undefined };
}

export async function installScrcpy(): Promise<{ ok: boolean; error?: string }> {
  try {
    const agentDeckDir = path.join(os.homedir(), '.agentdeck');
    if (!fs.existsSync(agentDeckDir)) {
      fs.mkdirSync(agentDeckDir, { recursive: true });
    }

    const zipPath = path.join(agentDeckDir, 'scrcpy.zip');
    
    // We only support auto-downloading for Windows
    if (process.platform !== 'win32') {
      return { ok: false, error: 'Automatic installation is only supported on Windows. Please install scrcpy via brew or apt.' };
    }

    const downloadUrl = 'https://github.com/Genymobile/scrcpy/releases/download/v2.4/scrcpy-win64-v2.4.zip';

    // Download the ZIP file
    await downloadFile(downloadUrl, zipPath);

    // Extract the ZIP file to a temp location first
    const scrcpyDest = path.join(agentDeckDir, 'scrcpy-temp');
    if (fs.existsSync(scrcpyDest)) {
      fs.rmSync(scrcpyDest, { recursive: true, force: true });
    }
    fs.mkdirSync(scrcpyDest, { recursive: true });

    const extractCmd = `powershell.exe -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${scrcpyDest}' -Force"`;
    await execAsync(extractCmd);

    // Relocate final files
    const files = fs.readdirSync(scrcpyDest);
    const subfolder = files.find(f => f.startsWith('scrcpy-win64-'));
    if (!subfolder) {
      return { ok: false, error: 'Failed to locate extracted scrcpy folder.' };
    }

    const finalPath = path.join(agentDeckDir, 'scrcpy');
    if (fs.existsSync(finalPath)) {
      fs.rmSync(finalPath, { recursive: true, force: true });
    }

    fs.renameSync(path.join(scrcpyDest, subfolder), finalPath);
    
    // Clean up
    fs.rmSync(scrcpyDest, { recursive: true, force: true });
    try {
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
      }
    } catch {
      // Ignore
    }

    cachedScrcpyPath = null;
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Unknown scrcpy installation error.' };
  }
}

export async function launchScrcpy(deviceId: string): Promise<void> {
  validateDeviceId(deviceId);
  
  const scrcpyPath = await getScrcpyPath();
  if (!scrcpyPath) {
    throw new Error('scrcpy is not installed.');
  }

  // Spawn scrcpy in background detached mode
  const { spawn } = await import('node:child_process');
  const child = spawn(scrcpyPath, ['-s', deviceId], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
}

export async function getDeviceScreenSize(deviceId: string): Promise<{ width: number; height: number }> {
  validateDeviceId(deviceId);

  const adbPath = await getAdbPath();
  const { stdout } = await execFileAsync(adbPath, ['-s', deviceId, 'shell', 'wm', 'size'], {
    timeout: 3000,
    windowsHide: true
  });

  const match = stdout.match(/(\d+)x(\d+)/);
  if (match) {
    return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
  }
  return { width: 1080, height: 2400 };
}

export async function sendAdbInput(deviceId: string, type: 'tap' | 'swipe' | 'keyevent', params: any): Promise<void> {
  validateDeviceId(deviceId);

  const adbPath = await getAdbPath();
  let args: string[] = ['-s', deviceId, 'shell', 'input'];
  
  if (type === 'tap') {
    const x = Math.round(params.x);
    const y = Math.round(params.y);
    args.push('tap', String(x), String(y));
  } else if (type === 'swipe') {
    const x1 = Math.round(params.x1);
    const y1 = Math.round(params.y1);
    const x2 = Math.round(params.x2);
    const y2 = Math.round(params.y2);
    const duration = params.duration || 300;
    args.push('swipe', String(x1), String(y1), String(x2), String(y2), String(duration));
  } else if (type === 'keyevent') {
    const key = params.key;
    if (typeof key !== 'string' || !/^[a-zA-Z0-9_]+$/.test(key)) {
      throw new Error('Invalid key code');
    }
    args.push('keyevent', key);
  } else {
    throw new Error('Unsupported input type');
  }

  await execFileAsync(adbPath, args, { timeout: 3000, windowsHide: true });
}

