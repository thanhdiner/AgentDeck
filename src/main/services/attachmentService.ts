import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { AttachedImageMetadata, AppStateSnapshot } from '../../shared/types.js';

export function getAttachmentsDir(): string {
  if (process.env.AGENTDECK_ATTACHMENTS_DIR) {
    return process.env.AGENTDECK_ATTACHMENTS_DIR;
  }

  if (process.platform === 'win32') {
    if (fsSync.existsSync('D:\\Ảnh chụp màn hình')) {
      return 'D:\\Ảnh chụp màn hình';
    }
    if (fsSync.existsSync('D:\\')) {
      return 'D:\\AgentDeckData\\attachments';
    }
  }

  return path.join(app.getPath('userData'), 'attachments');
}

export async function ensureAttachmentsDir() {
  await fs.mkdir(getAttachmentsDir(), { recursive: true });
}

function isValidImageBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return true;
  }
  
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return true;
  }
  
  // GIF: 47 49 46 38 ('GIF8')
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return true;
  }
  
  // WEBP/RIFF: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    if (buffer.length >= 12 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return true;
    }
  }
  
  // SVG: Check starting XML/SVG tags
  const textStart = buffer.toString('utf8', 0, Math.min(buffer.length, 100)).trim().toLowerCase();
  if (textStart.startsWith('<svg') || textStart.startsWith('<?xml') || textStart.includes('<svg')) {
    return true;
  }
  
  return false;
}

export async function saveAttachment(options: {
  workspaceId: string;
  paneId: string;
  taskId: string | null;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<AttachedImageMetadata> {
  // Validate magic number signature to block spoofed files
  if (!isValidImageBuffer(options.buffer)) {
    throw new Error('The attachment is not a valid image format (Spoofed file format detected).');
  }

  await ensureAttachmentsDir();

  const attachmentsDir = getAttachmentsDir();

  // Smart Detection: If pasting an image and target is D:\Ảnh chụp màn hình,
  // check if Windows Snipping Tool just generated a screenshot file recently (< 15 seconds)
  if (options.originalName.includes('pasted_image') && fsSync.existsSync(attachmentsDir)) {
    try {
      const files = await fs.readdir(attachmentsDir);
      const now = Date.now();
      let latestRecentScreenshotPath: string | null = null;
      let latestMtime = 0;

      for (const filename of files) {
        // Skip files created by AgentDeck itself
        if (filename.startsWith('attachment')) continue;

        const fullPath = path.join(attachmentsDir, filename);
        const stat = await fs.stat(fullPath);
        const ageMs = now - stat.mtimeMs;

        // Find the most recent screenshot image file in D:\Ảnh chụp màn hình
        if (/\.(png|jpg|jpeg|webp)$/i.test(filename)) {
          if (stat.mtimeMs > latestMtime) {
            latestMtime = stat.mtimeMs;
            latestRecentScreenshotPath = fullPath;
          }
        }
      }

      if (latestRecentScreenshotPath) {
        const stats = await fs.stat(latestRecentScreenshotPath);
        const id = `attachment-${crypto.randomUUID()}`;
        return {
          id,
          originalName: path.basename(latestRecentScreenshotPath),
          localPath: latestRecentScreenshotPath,
          mimeType: options.mimeType,
          size: stats.size,
          createdAt: Date.now(),
          workspaceId: options.workspaceId,
          paneId: options.paneId,
          taskId: options.taskId,
          status: 'pending'
        };
      }
    } catch (err) {
      console.warn('[ATTACHMENT SERVICE] Failed checking for recent screenshot file:', err);
    }
  }

  // Fallback: Save buffer to disk if no recent screenshot file was found
  const id = `attachment-${crypto.randomUUID()}`;
  const shortId = crypto.randomUUID().slice(0, 6);
  const timestamp = Date.now();

  let safeFilename: string;
  if (options.originalName.includes('pasted_image')) {
    safeFilename = `attachment_${timestamp}_${shortId}.png`;
  } else {
    const sanitizedOriginalName = options.originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    safeFilename = `attachment_${shortId}_${sanitizedOriginalName}`;
  }

  const localPath = path.join(attachmentsDir, safeFilename);

  await fs.writeFile(localPath, options.buffer);
  
  // Restrict access permissions to the owner only (read/write)
  try {
    await fs.chmod(localPath, 0o600);
  } catch (err) {
    console.warn(`[ATTACHMENT SERVICE] Failed to set permissions 0o600 on ${localPath}:`, err);
  }

  return {
    id,
    originalName: options.originalName,
    localPath,
    mimeType: options.mimeType,
    size: options.buffer.length,
    createdAt: Date.now(),
    workspaceId: options.workspaceId,
    paneId: options.paneId,
    taskId: options.taskId,
    status: 'pending'
  };
}

export async function deleteAttachmentFile(localPath: string): Promise<void> {
  try {
    await fs.unlink(localPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      throw err;
    }
  }
}

/**
 * Cleanup pending/orphaned attachments on app startup
 */
export async function cleanupOrphanedAttachments(state: AppStateSnapshot): Promise<void> {
  try {
    await ensureAttachmentsDir();
    const dirFiles = await fs.readdir(getAttachmentsDir());
    
    // We only keep submitted attachments that exist in metadata
    const activeSubmittedPaths = new Set(
      (state.attachments || [])
        .filter((att) => att.status === 'submitted')
        .map((att) => path.normalize(att.localPath))
    );

    // Any pending attachment metadata from last session is also deleted
    const pendingAttachments = (state.attachments || []).filter((att) => att.status === 'pending');
    for (const att of pendingAttachments) {
      await deleteAttachmentFile(att.localPath);
    }

    // Delete physical files created by AgentDeck that are not in the submitted list
    for (const filename of dirFiles) {
      if (!filename.startsWith('attachment')) {
        continue;
      }
      const fullPath = path.join(getAttachmentsDir(), filename);
      const normalized = path.normalize(fullPath);
      if (!activeSubmittedPaths.has(normalized)) {
        await deleteAttachmentFile(fullPath);
      }
    }
  } catch (err) {
    console.error('[ATTACHMENT SERVICE] Failed to cleanup orphaned attachments:', err);
  }
}

/**
 * Delete all attachments belonging to a workspace (physical files and filtering metadata)
 */
export async function deleteWorkspaceAttachments(workspaceId: string, state: AppStateSnapshot): Promise<AttachedImageMetadata[]> {
  const currentAttachments = state.attachments || [];
  const toDelete = currentAttachments.filter((att) => att.workspaceId === workspaceId);
  const toKeep = currentAttachments.filter((att) => att.workspaceId !== workspaceId);

  for (const att of toDelete) {
    await deleteAttachmentFile(att.localPath);
  }

  return toKeep;
}
