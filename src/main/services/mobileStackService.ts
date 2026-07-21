// Đã đọc AGENTS.md
import fs from 'node:fs/promises';
import path from 'node:path';
import type { MobileStackDetection } from '../../shared/types.js';

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function readPackageJson(workspacePath: string): Promise<any | null> {
  try {
    const p = path.join(workspacePath, 'package.json');
    if (await fileExists(p)) {
      const content = await fs.readFile(p, 'utf8');
      return JSON.parse(content);
    }
  } catch {
    // Ignore JSON parsing or read errors
  }
  return null;
}

export async function detectMobileStack(workspacePath: string): Promise<MobileStackDetection> {
  try {
    const resolvedPath = path.resolve(workspacePath);
    const reasons: string[] = [];
    const suggestedCommands: MobileStackDetection['suggestedCommands'] = [];

    const hasPackageJson = await fileExists(path.join(resolvedPath, 'package.json'));
    const pkgJson = hasPackageJson ? await readPackageJson(resolvedPath) : null;
    const hasAppJson = await fileExists(path.join(resolvedPath, 'app.json'));
    const hasAppConfigJs = await fileExists(path.join(resolvedPath, 'app.config.js'));
    const hasAppConfigTs = await fileExists(path.join(resolvedPath, 'app.config.ts'));

    const hasPubspecYaml = await fileExists(path.join(resolvedPath, 'pubspec.yaml'));
    const hasLibDir = await isDirectory(path.join(resolvedPath, 'lib'));

    const hasAndroidDir = await isDirectory(path.join(resolvedPath, 'android'));
    const hasAndroidGradlew = await fileExists(path.join(resolvedPath, 'android', 'gradlew')) || await fileExists(path.join(resolvedPath, 'android', 'gradlew.bat'));
    const hasAndroidAppBuildGradle = await fileExists(path.join(resolvedPath, 'android', 'app', 'build.gradle')) || await fileExists(path.join(resolvedPath, 'android', 'app', 'build.gradle.kts'));

    const hasSettingsGradle = await fileExists(path.join(resolvedPath, 'settings.gradle')) || await fileExists(path.join(resolvedPath, 'settings.gradle.kts'));
    const hasRootBuildGradle = await fileExists(path.join(resolvedPath, 'build.gradle')) || await fileExists(path.join(resolvedPath, 'build.gradle.kts'));
    const hasAndroidManifest = await fileExists(path.join(resolvedPath, 'app', 'src', 'main', 'AndroidManifest.xml'));
    const hasRootGradlew = await fileExists(path.join(resolvedPath, 'gradlew')) || await fileExists(path.join(resolvedPath, 'gradlew.bat'));

    // 1. Detect Expo
    let isExpo = false;
    if (pkgJson) {
      const deps = { ...(pkgJson.dependencies || {}), ...(pkgJson.devDependencies || {}) };
      if (deps['expo']) {
        isExpo = true;
        reasons.push("package.json contains 'expo' dependency");
      }
    }
    if (hasAppJson) {
      isExpo = true;
      reasons.push("app.json exists in workspace root");
    }
    if (hasAppConfigJs) {
      isExpo = true;
      reasons.push("app.config.js exists in workspace root");
    }
    if (hasAppConfigTs) {
      isExpo = true;
      reasons.push("app.config.ts exists in workspace root");
    }

    if (isExpo) {
      suggestedCommands.push({
        label: "Start Expo Server",
        command: "npx expo start",
        cwd: resolvedPath,
        requiresBuild: false,
        note: "Starts the Expo Metro bundler."
      });
      if (hasAndroidDir) {
        suggestedCommands.push({
          label: "Run Dev Build on Android",
          command: "npx expo run:android",
          cwd: resolvedPath,
          requiresBuild: true,
          note: "Builds and runs local Android development build."
        });
      }
      return {
        type: 'expo',
        confidence: 'high',
        reasons,
        suggestedCommands
      };
    }

    // 2. Detect React Native CLI
    let isReactNative = false;
    if (pkgJson) {
      const deps = { ...(pkgJson.dependencies || {}), ...(pkgJson.devDependencies || {}) };
      if (deps['react-native']) {
        isReactNative = true;
        reasons.push("package.json contains 'react-native' dependency");
      }
    }

    if (isReactNative && hasAndroidDir && (hasAndroidGradlew || hasAndroidAppBuildGradle)) {
      if (!reasons.includes("android/ folder exists with gradle scripts")) {
        reasons.push("android/ folder exists with gradle scripts");
      }
      const hasAndroidScript = pkgJson?.scripts?.android;
      if (hasAndroidScript) {
        suggestedCommands.push({
          label: "Run on Android (npm)",
          command: "npm run android",
          cwd: resolvedPath,
          requiresBuild: true,
          note: "Runs the 'android' script from package.json."
        });
      }
      suggestedCommands.push({
        label: "Run on Android (RN CLI)",
        command: "npx react-native run-android",
        cwd: resolvedPath,
        requiresBuild: true,
        note: "Runs the app on device using react-native CLI."
      });
      return {
        type: 'react-native',
        confidence: 'high',
        reasons,
        suggestedCommands
      };
    }

    // 3. Detect Flutter
    if (hasPubspecYaml && hasLibDir && hasAndroidDir) {
      reasons.push("pubspec.yaml, lib/ folder, and android/ folder exist");
      suggestedCommands.push({
        label: "Run on Android Device",
        command: "flutter run",
        cwd: resolvedPath,
        requiresBuild: true,
        note: "Launches the Flutter application on your device."
      });
      return {
        type: 'flutter',
        confidence: 'high',
        reasons,
        suggestedCommands
      };
    }

    // 4. Detect Native Android
    if (hasSettingsGradle && hasRootBuildGradle && hasAndroidManifest && hasRootGradlew) {
      reasons.push("gradlew, settings.gradle, build.gradle, and AndroidManifest.xml exist");
      const isWindows = process.platform === 'win32';
      const gradleCmd = isWindows ? ".\\gradlew installDebug" : "./gradlew installDebug";
      suggestedCommands.push({
        label: "Install Debug APK",
        command: gradleCmd,
        cwd: resolvedPath,
        requiresBuild: true,
        note: "Assembles and installs debug apk on the connected device."
      });
      return {
        type: 'native-android',
        confidence: 'high',
        reasons,
        suggestedCommands
      };
    }

    // 5. Unknown
    return {
      type: 'unknown',
      confidence: 'low',
      reasons: ["No mobile stack signature files detected in the workspace root."],
      suggestedCommands: []
    };
  } catch (err: any) {
    return {
      type: 'unknown',
      confidence: 'low',
      reasons: [`Detection failed: ${err.message || err}`],
      suggestedCommands: []
    };
  }
}
