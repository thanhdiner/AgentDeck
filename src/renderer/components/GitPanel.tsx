import React, { useState, useEffect, useCallback } from 'react';
import type { GitWorkspaceStatus } from '../../shared/types.js';

interface GitPanelProps {
  workspaceRoot: string;
}

// Hàm parse từng dòng git status porcelain
export function parseGitStatusLine(fileLine: string) {
  const code = fileLine.slice(0, 2);
  let pathPart = fileLine.slice(2).trim();
  if (pathPart.startsWith('"') && pathPart.endsWith('"')) {
    pathPart = pathPart.slice(1, -1).replace(/\\"/g, '"');
  }

  let oldPath: string | undefined = undefined;
  if (code.startsWith('R') || pathPart.includes(' -> ')) {
    const arrowIndex = pathPart.indexOf(' -> ');
    if (arrowIndex !== -1) {
      oldPath = pathPart.slice(0, arrowIndex).trim();
      pathPart = pathPart.slice(arrowIndex + 4).trim();
      if (oldPath.startsWith('"') && oldPath.endsWith('"')) {
        oldPath = oldPath.slice(1, -1).replace(/\\"/g, '"');
      }
      if (pathPart.startsWith('"') && pathPart.endsWith('"')) {
        pathPart = pathPart.slice(1, -1).replace(/\\"/g, '"');
      }
    }
  }
  return { code, path: pathPart, oldPath };
}

export function getStatusBadge(code: string) {
  const c = code.trim();
  if (c === '??') return { char: 'U', color: '#22c55e', label: 'Untracked', bg: 'rgba(34, 197, 94, 0.12)' };
  if (c === 'A') return { char: 'A', color: '#22c55e', label: 'Added', bg: 'rgba(34, 197, 94, 0.12)' };
  if (c === 'D') return { char: 'D', color: '#ef4444', label: 'Deleted', bg: 'rgba(239, 68, 68, 0.12)' };
  if (c === 'R') return { char: 'R', color: '#eab308', label: 'Renamed', bg: 'rgba(234, 179, 8, 0.12)' };
  if (c.includes('U')) return { char: 'C', color: '#ef4444', label: 'Conflict', bg: 'rgba(239, 68, 68, 0.12)' };
  // Default is Modified
  return { char: 'M', color: '#eab308', label: 'Modified', bg: 'rgba(234, 179, 8, 0.12)' };
}

export function GitPanel({ workspaceRoot }: GitPanelProps) {
  const [detectedRepos, setDetectedRepos] = useState<string[]>([]);
  const [selectedRepoPath, setSelectedRepoPath] = useState<string>('');
  const [scanLoading, setScanLoading] = useState(false);
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);

  const [gitStatus, setGitStatus] = useState<GitWorkspaceStatus | null>(null);
  const [gitLoading, setGitLoading] = useState(false);

  const [commitMessage, setCommitMessage] = useState('');
  const [checkedFiles, setCheckedFiles] = useState<Record<string, boolean>>({});
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState('');
  const [diffLoading, setDiffLoading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isDiscardingAll, setIsDiscardingAll] = useState(false);
  const [isDiscardingFile, setIsDiscardingFile] = useState<Record<string, boolean>>({});
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  // 1. Quét tìm các Git Repositories (Dự án con) trong Workspace
  useEffect(() => {
    if (!workspaceRoot) {
      setDetectedRepos([]);
      setSelectedRepoPath('');
      return;
    }

    setScanLoading(true);
    let isMounted = true;

    async function scanRepos() {
      const repos: string[] = [];

      // A. Kiểm tra xem chính thư mục gốc của workspace có phải là repo không
      try {
        const rootStatus = await window.agentDeck.getGitWorkspaceStatus(workspaceRoot);
        if (rootStatus.isRepo) {
          repos.push(workspaceRoot);
        }
      } catch (err) {
        console.error('Error checking workspace root repo:', err);
      }

      // B. Quét các thư mục con cấp 1 xem có chứa thư mục .git không
      try {
        const res = await window.agentDeck.readDir(workspaceRoot);
        if (res.ok && isMounted) {
          const subdirs = res.data.filter(
            (item) => item.isDirectory && item.name !== '.git' && item.name !== 'node_modules'
          );

          await Promise.all(
            subdirs.map(async (dir) => {
              try {
                const subStatus = await window.agentDeck.getGitWorkspaceStatus(dir.path);
                if (subStatus && subStatus.isRepo && isMounted) {
                  repos.push(dir.path);
                }
              } catch (e) {
                // Bỏ qua lỗi
              }
            })
          );
        }
      } catch (err) {
        console.error('Error scanning subdirectories for Git:', err);
      }

      if (isMounted) {
        const uniqueRepos = Array.from(new Set(repos));
        setDetectedRepos(uniqueRepos);
        setScanLoading(false);

        // Đặt mặc định dự án được chọn:
        // Ưu tiên thư mục gốc nếu nó là Git Repo.
        // Nếu không, tự động chọn Git Repo con đầu tiên tìm thấy.
        // Nếu không có repo nào, đặt là thư mục gốc.
        if (uniqueRepos.includes(workspaceRoot)) {
          setSelectedRepoPath(workspaceRoot);
        } else if (uniqueRepos.length > 0) {
          setSelectedRepoPath(uniqueRepos[0]);
        } else {
          setSelectedRepoPath(workspaceRoot);
        }
      }
    }

    void scanRepos();

    return () => {
      isMounted = false;
    };
  }, [workspaceRoot]);

  // Click outside để tự đóng dropdown chọn repo
  useEffect(() => {
    if (!repoDropdownOpen) return;
    const handleClose = () => setRepoDropdownOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [repoDropdownOpen]);

  // 2. Load Git Status của thư mục/dự án được lựa chọn
  const loadGitStatus = useCallback(async () => {
    if (!selectedRepoPath) {
      setGitStatus(null);
      return;
    }
    setGitLoading(true);
    try {
      const res = await window.agentDeck.getGitWorkspaceStatus(selectedRepoPath);
      if (res && res.isRepo) {
        setGitStatus(res);
      } else {
        setGitStatus(null);
      }
    } catch (err) {
      console.error('Failed to load git status for path:', selectedRepoPath, err);
      setGitStatus(null);
    } finally {
      setGitLoading(false);
    }
  }, [selectedRepoPath]);

  // Tải lại status khi thay đổi dự án được chọn hoặc trên timer 10 giây
  useEffect(() => {
    if (!selectedRepoPath) return;

    void loadGitStatus();
    setSelectedDiffFile(null); // Reset diff đang xem khi chuyển repo

    const timer = setInterval(() => {
      void loadGitStatus();
    }, 10000);

    return () => clearInterval(timer);
  }, [selectedRepoPath, loadGitStatus]);

  // Auto check tất cả file thay đổi khi load status của dự án mới
  useEffect(() => {
    if (gitStatus?.changedFiles) {
      setCheckedFiles((prev) => {
        const next = { ...prev };
        gitStatus.changedFiles.forEach((line) => {
          const { path } = parseGitStatusLine(line);
          if (next[path] === undefined) {
            next[path] = true;
          }
        });
        // Clear những file ko còn thay đổi nữa trong repo này
        const activePaths = gitStatus.changedFiles.map((line) => parseGitStatusLine(line).path);
        Object.keys(next).forEach((p) => {
          if (!activePaths.includes(p)) {
            delete next[p];
          }
        });
        return next;
      });
    }
  }, [gitStatus]);

  // Load diff của file đang chọn
  const loadFileDiff = useCallback(
    async (filePath: string) => {
      if (!selectedRepoPath) return;
      setDiffLoading(true);
      try {
        const res = await window.agentDeck.getGitFileDiff(selectedRepoPath, filePath);
        if (res.ok) {
          setDiffContent(res.data);
        } else {
          setDiffContent(`Lỗi khi đọc thay đổi (diff): ${res.error.message}`);
        }
      } catch (err) {
        console.error('Failed to get diff:', err);
        setDiffContent(`Lỗi khi đọc thay đổi (diff): ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setDiffLoading(false);
      }
    },
    [selectedRepoPath]
  );

  useEffect(() => {
    if (selectedDiffFile) {
      void loadFileDiff(selectedDiffFile);
    }
  }, [selectedDiffFile, loadFileDiff]);

  // Master Checkbox
  const allChecked =
    gitStatus?.changedFiles && gitStatus.changedFiles.length > 0
      ? gitStatus.changedFiles.every((line) => {
          const { path } = parseGitStatusLine(line);
          return checkedFiles[path];
        })
      : false;

  const toggleAll = () => {
    if (!gitStatus?.changedFiles) return;
    const nextState = !allChecked;
    const next = { ...checkedFiles };
    gitStatus.changedFiles.forEach((line) => {
      const { path } = parseGitStatusLine(line);
      next[path] = nextState;
    });
    setCheckedFiles(next);
  };

  const handleToggleFile = (path: string) => {
    setCheckedFiles((prev) => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  // Tạo Commit Message tự động bằng AI
  const handleGenerateCommitMessage = async () => {
    if (!selectedRepoPath) return;

    let filesToCommit = Object.keys(checkedFiles).filter((p) => checkedFiles[p]);
    if (filesToCommit.length === 0) {
      // Nếu không có file nào được tick, lấy toàn bộ file thay đổi
      if (gitStatus?.changedFiles) {
        filesToCommit = gitStatus.changedFiles.map(line => parseGitStatusLine(line).path);
      }
    }

    if (filesToCommit.length === 0) {
      alert('Vui lòng chọn hoặc có ít nhất một tệp thay đổi để tạo thông điệp commit.');
      return;
    }

    let settings: any = null;
    try {
      const saved = localStorage.getItem('agentdeck_llm_settings');
      if (saved) {
        settings = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse LLM settings:', e);
    }

    if (!settings || !settings.provider || (!settings.apiKey && settings.provider !== 'ollama')) {
      alert('Chưa cấu hình AI. Vui lòng chuyển qua tab Settings để thiết lập LLM Provider và API Key.');
      return;
    }

    setIsGeneratingMessage(true);
    const oldMessage = commitMessage;
    setCommitMessage('');

    try {
      const res = await window.agentDeck.generateCommitMessage(selectedRepoPath, filesToCommit, settings);
      if (res.ok) {
        setCommitMessage(res.data);
      } else {
        setCommitMessage(oldMessage);
        alert(`Tạo commit message thất bại: ${res.error.message}`);
      }
    } catch (err) {
      console.error('Failed to generate commit message:', err);
      setCommitMessage(oldMessage);
      alert(`Lỗi khi tạo commit message: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGeneratingMessage(false);
    }
  };

  const handleGitFetch = async () => {
    if (!selectedRepoPath) return;
    setIsFetching(true);
    try {
      const res = await window.agentDeck.gitFetch(selectedRepoPath);
      if (res.ok) {
        await loadGitStatus();
      } else {
        alert(`Fetch thất bại: ${res.error.message}`);
      }
    } catch (err) {
      console.error('Fetch failed:', err);
      alert(`Fetch gặp lỗi: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsFetching(false);
    }
  };

  const handleGitPull = async () => {
    if (!selectedRepoPath) return;
    setIsPulling(true);
    try {
      const res = await window.agentDeck.gitPull(selectedRepoPath);
      if (res.ok) {
        alert('Git Pull thành công:\n' + res.data);
        await loadGitStatus();
      } else {
        alert(`Pull thất bại: ${res.error.message}`);
      }
    } catch (err) {
      console.error('Pull failed:', err);
      alert(`Pull gặp lỗi: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsPulling(false);
    }
  };

  const handleGitPush = async () => {
    if (!selectedRepoPath) return;
    setIsPushing(true);
    try {
      const res = await window.agentDeck.gitPush(selectedRepoPath);
      if (res.ok) {
        alert('Git Push thành công:\n' + res.data);
        await loadGitStatus();
      } else {
        alert(`Push thất bại: ${res.error.message}`);
      }
    } catch (err) {
      console.error('Push failed:', err);
      alert(`Push gặp lỗi: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsPushing(false);
    }
  };

  // Trình tự Commit
  const handleCommit = async () => {
    const trimmedMessage = commitMessage.trim();
    if (!trimmedMessage || !selectedRepoPath) return;

    const filesToCommit = Object.keys(checkedFiles).filter((p) => checkedFiles[p]);
    if (filesToCommit.length === 0) return;

    setIsCommitting(true);
    try {
      const res = await window.agentDeck.commitGitChanges(selectedRepoPath, filesToCommit, trimmedMessage);
      if (res.ok) {
        setCommitMessage('');
        await loadGitStatus();
      } else {
        alert(`Commit thất bại: ${res.error.message}`);
      }
    } catch (err) {
      console.error('Failed to commit changes:', err);
      alert(`Commit gặp lỗi: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsCommitting(false);
    }
  };

  // Xử lý phím tắt Ctrl + Enter trong Textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleCommit();
    }
  };

  // Discard file lẻ
  const handleDiscardFile = async (e: React.MouseEvent, filePath: string) => {
    e.stopPropagation();
    if (!selectedRepoPath) return;

    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn hủy tất cả các thay đổi chưa commit trong file:\n"${filePath}" không?\nHành động này không thể hoàn tác.`
    );
    if (!confirmed) return;

    setIsDiscardingFile((prev) => ({ ...prev, [filePath]: true }));
    try {
      const res = await window.agentDeck.discardGitFileChanges(selectedRepoPath, filePath);
      if (res.ok) {
        if (selectedDiffFile === filePath) {
          setSelectedDiffFile(null);
        }
        await loadGitStatus();
      } else {
        alert(`Khôi phục thay đổi thất bại: ${res.error.message}`);
      }
    } catch (err) {
      console.error('Failed to discard changes for file:', err);
      alert(`Khôi phục thay đổi gặp lỗi: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDiscardingFile((prev) => ({ ...prev, [filePath]: false }));
    }
  };

  // Discard All
  const handleDiscardAll = async () => {
    if (!selectedRepoPath) return;

    const confirmed = window.confirm(
      'CẢNH BÁO: Bạn có chắc chắn muốn hủy toàn bộ các thay đổi chưa commit trong thư mục dự án được chọn không?\nHành động này sẽ xóa hết các sửa đổi và tệp untracked, không thể hoàn tác.'
    );
    if (!confirmed) return;

    setIsDiscardingAll(true);
    try {
      const res = await window.agentDeck.discardAllGitChanges(selectedRepoPath);
      if (res.ok) {
        setSelectedDiffFile(null);
        await loadGitStatus();
      } else {
        alert(`Hủy thay đổi thất bại: ${res.error.message}`);
      }
    } catch (err) {
      console.error('Failed to discard all changes:', err);
      alert(`Hủy thay đổi gặp lỗi: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDiscardingAll(false);
    }
  };

  // Render Diff line-by-line
  const renderDiffLine = (line: string, index: number) => {
    const style: React.CSSProperties = {
      fontFamily: '"JetBrains Mono", Consolas, monospace',
      fontSize: '11px',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      padding: '2px 8px',
      display: 'flex',
      lineHeight: '1.4'
    };

    if (line.startsWith('+') && !line.startsWith('+++')) {
      return (
        <div key={index} style={{ ...style, backgroundColor: 'rgba(34, 197, 94, 0.12)', color: '#4ade80' }}>
          <span style={{ userSelect: 'none', marginRight: '8px', opacity: 0.5 }}>+</span>
          {line.slice(1)}
        </div>
      );
    }
    if (line.startsWith('-') && !line.startsWith('---')) {
      return (
        <div key={index} style={{ ...style, backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#f87171' }}>
          <span style={{ userSelect: 'none', marginRight: '8px', opacity: 0.5 }}>-</span>
          {line.slice(1)}
        </div>
      );
    }
    if (line.startsWith('@@')) {
      return (
        <div key={index} style={{ ...style, backgroundColor: 'rgba(99, 102, 241, 0.08)', color: '#818cf8', fontWeight: 'bold' }}>
          {line}
        </div>
      );
    }
    if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
      return (
        <div key={index} style={{ ...style, color: '#a1a1aa', fontSize: '11px' }}>
          {line}
        </div>
      );
    }

    return (
      <div key={index} style={{ ...style, color: '#e4e4e7' }}>
        <span style={{ userSelect: 'none', marginRight: '14px' }}> </span>
        {line}
      </div>
    );
  };

  // Trình xem Diff (Diff Viewer)
  if (selectedDiffFile) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#121214',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility'
      }}>
        {/* Header của Diff */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid #262626',
          background: '#161618'
        }}>
          <button
            onClick={() => setSelectedDiffFile(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 500,
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#f4f4f5';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#a1a1aa';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Quay lại
          </button>
          <div style={{
            fontSize: '12px',
            color: '#f4f4f5',
            fontWeight: 600,
            maxWidth: '180px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }} title={selectedDiffFile}>
            {selectedDiffFile.split('/').pop()}
          </div>
          <button
            onClick={(e) => handleDiscardFile(e, selectedDiffFile)}
            disabled={isDiscardingFile[selectedDiffFile]}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.28)',
              color: '#f87171',
              cursor: 'pointer',
              fontSize: '11.5px',
              fontWeight: 500,
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.color = '#fca5a5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.color = '#f87171';
            }}
          >
            Hủy thay đổi
          </button>
        </div>

        {/* Khung Diff Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '10px 0' }}>
          {diffLoading ? (
            <div style={{ color: '#a1a1aa', fontSize: '12px', padding: '20px', textAlign: 'center' }}>
              Đang tải thay đổi...
            </div>
          ) : !diffContent ? (
            <div style={{
              margin: '16px 12px',
              background: '#141416',
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              padding: '28px 16px',
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 500,
              color: '#a1a1aa',
              lineHeight: 1.5
            }}>
              Không có thay đổi nào.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {diffContent.split(/\r?\n/).map((line, idx) => renderDiffLine(line, idx))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const hasChanges = gitStatus?.changedFiles && gitStatus.changedFiles.length > 0;
  const filesToCommitCount = Object.keys(checkedFiles).filter((p) => checkedFiles[p]).length;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#121214',
      overflow: 'hidden',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
      textRendering: 'optimizeLegibility'
    }}>
      
      {/* 1. Bộ Chọn Dự Án / Repository Dropdown (giúp giảm lag tải thư mục lớn) */}
      {detectedRepos.length > 1 && (
        <div style={{ position: 'relative', padding: '8px 12px', borderBottom: '1px solid #262626', background: '#151518', zIndex: 10 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRepoDropdownOpen(!repoDropdownOpen);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '6px 10px',
              background: '#1c1c1e',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              color: '#e4e4e7',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
            onMouseLeave={(e) => {
              if (!repoDropdownOpen) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <circle cx="6" cy="6" r="1" fill="currentColor" />
                <circle cx="6" cy="18" r="1" fill="currentColor" />
              </svg>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Dự án: {selectedRepoPath === workspaceRoot ? 'Thư mục gốc' : selectedRepoPath.split(/[\\/]/).pop()}
              </span>
            </span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: repoDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {repoDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: '12px',
              right: '12px',
              marginTop: '4px',
              /* solid surface — no backdrop-filter under text (crisp-text-dark-ui) */
              background: '#1a1a1c',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6)',
              zIndex: 999,
              padding: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '4px 8px 6px' }}>
                Chọn kho lưu trữ để tải thay đổi
              </div>
              {detectedRepos.map((repoPath) => {
                const isSelected = repoPath === selectedRepoPath;
                const name = repoPath === workspaceRoot ? 'Thư mục gốc (Gốc)' : repoPath.split(/[\\/]/).pop();
                return (
                  <button
                    key={repoPath}
                    onClick={() => {
                      setSelectedRepoPath(repoPath);
                      setRepoDropdownOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '6px 8px',
                      background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                      border: 'none',
                      borderRadius: '3px',
                      color: isSelected ? '#7dd3fc' : '#d4d4d8',
                      fontSize: '12px',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.color = '#f4f4f5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#d4d4d8';
                      }
                    }}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                      <span style={{ fontWeight: isSelected ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                      <span style={{ fontSize: '11px', color: '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {repoPath}
                      </span>
                    </span>
                    {isSelected && <span style={{ width: '4px', height: '4px', background: '#38bdf8', borderRadius: '50%', marginLeft: '8px', flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. Branch Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        borderBottom: '1px solid #262626',
        background: '#161618'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f4f4f5', fontSize: '12px', fontWeight: 600, minWidth: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
          </svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {gitStatus?.branch || 'HEAD'}
          </span>
          {detectedRepos.length <= 1 && (
            <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ({selectedRepoPath === workspaceRoot ? 'Thư mục gốc' : selectedRepoPath.split(/[\\/]/).pop()})
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Pull Button */}
          <button
            onClick={() => void handleGitPull()}
            disabled={gitLoading || scanLoading || isPulling || isPushing || isFetching}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'all 0.15s ease'
            }}
            title="Git Pull"
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.color = '#e4e4e7'; }}
            onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.color = '#a1a1aa'; }}
          >
            {isPulling ? (
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '1.5px solid rgba(255, 255, 255, 0.1)', borderTopColor: '#94a3b8', animation: 'spin 1s linear infinite' }} />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
            )}
          </button>

          {/* Push Button */}
          <button
            onClick={() => void handleGitPush()}
            disabled={gitLoading || scanLoading || isPulling || isPushing || isFetching}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'all 0.15s ease'
            }}
            title="Git Push"
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.color = '#e4e4e7'; }}
            onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.color = '#a1a1aa'; }}
          >
            {isPushing ? (
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '1.5px solid rgba(255, 255, 255, 0.1)', borderTopColor: '#94a3b8', animation: 'spin 1s linear infinite' }} />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            )}
          </button>

          {/* Separator */}
          <div style={{ width: '1px', height: '10px', backgroundColor: '#262626' }} />

          {/* Fetch/Refresh Button */}
          <button
            onClick={() => void handleGitFetch()}
            disabled={gitLoading || scanLoading || isPulling || isPushing || isFetching}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'all 0.15s ease'
            }}
            title="Git Fetch & Refresh"
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.color = '#e4e4e7'; }}
            onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.color = '#a1a1aa'; }}
          >
            {isFetching || gitLoading ? (
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '1.5px solid rgba(255, 255, 255, 0.1)', borderTopColor: '#94a3b8', animation: 'spin 1s linear infinite' }} />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M23 4v6h-6" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            )}
          </button>
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>

      {/* 3. Panel Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: '12px' }}>
        
        {scanLoading ? (
          <div style={{ color: '#a1a1aa', fontSize: '12px', padding: '40px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              border: '2px solid rgba(255, 255, 255, 0.1)',
              borderTopColor: '#3b82f6',
              animation: 'spin 1s linear infinite'
            }} />
            Đang quét các dự án Git...
          </div>
        ) : !gitStatus && !gitLoading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            alignItems: 'center',
            margin: '8px 0',
            padding: '28px 16px',
            textAlign: 'center',
            background: '#141416',
            border: '1px dashed rgba(255, 255, 255, 0.1)',
            borderRadius: 8
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="3" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>
              Chưa có kho Git
            </span>
            <span style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.5, maxWidth: 300, margin: 0 }}>
              Thư mục đang chọn không phải là một kho lưu trữ Git hoặc Git chưa được khởi tạo.
            </span>
            <button
              onClick={() => void loadGitStatus()}
              style={{
                background: '#1c1c1e',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
                color: '#e4e4e7',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Thử tải lại
            </button>
          </div>
        ) : (
          <>
            {/* Commit Input Area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <div style={{ position: 'relative' }}>
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isGeneratingMessage ? "AI đang phân tích thay đổi..." : "Commit message (Ctrl + Enter để commit)"}
                  disabled={!hasChanges || isCommitting || isGeneratingMessage}
                  rows={3}
                  style={{
                    width: '100%',
                    background: '#18181b',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    color: '#f4f4f5',
                    padding: '8px 32px 8px 8px',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    fontFamily: 'inherit',
                    resize: 'none',
                    outline: 'none',
                    transition: 'border-color 0.15s ease',
                    WebkitFontSmoothing: 'antialiased'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                />
                
                {/* AI Sparkles Button — dim via color, not opacity on text blocks */}
                <button
                  onClick={() => void handleGenerateCommitMessage()}
                  disabled={!hasChanges || isCommitting || isGeneratingMessage}
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '6px',
                    background: isGeneratingMessage ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    border: 'none',
                    color: isGeneratingMessage
                      ? '#38bdf8'
                      : (!hasChanges || isCommitting)
                        ? '#52525b'
                        : '#a1a1aa',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    cursor: (!hasChanges || isCommitting || isGeneratingMessage) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                    zIndex: 2,
                    opacity: 1
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.color = '#38bdf8';
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.color = '#a1a1aa';
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                  title="Tạo commit message bằng AI (Conventional Commits)"
                >
                  {isGeneratingMessage ? (
                    <div style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      border: '1.5px solid rgba(59, 130, 246, 0.2)',
                      borderTopColor: '#3b82f6',
                      animation: 'spin 1s linear infinite'
                    }} />
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                      <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5 5 3Z" opacity="0.6" />
                      <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5Z" opacity="0.6" />
                    </svg>
                  )}
                </button>
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => void handleCommit()}
                  disabled={!hasChanges || isCommitting || !commitMessage.trim() || filesToCommitCount === 0}
                  style={{
                    flex: 1,
                    background: '#3b82f6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px 12px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.background = '#2563eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.background = '#3b82f6';
                    }
                  }}
                >
                  {isCommitting ? 'Đang commit...' : `Commit (${filesToCommitCount})`}
                </button>
                
                <button
                  onClick={() => void handleDiscardAll()}
                  disabled={!hasChanges || isDiscardingAll}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.28)',
                    color: '#f87171',
                    borderRadius: '4px',
                    padding: '6px 12px',
                    fontSize: '11.5px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="Hủy toàn bộ thay đổi chưa commit"
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.28)';
                    }
                  }}
                >
                  {isDiscardingAll ? 'Đang hủy...' : 'Hủy tất cả'}
                </button>
              </div>
            </div>

            {/* Section Header: Changes */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 0',
                marginBottom: '8px',
                borderBottom: '1px solid #262626'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    disabled={!hasChanges}
                    style={{ cursor: hasChanges ? 'pointer' : 'not-allowed' }}
                  />
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Thay đổi ({gitStatus?.changedFiles?.length || 0})
                  </span>
                </div>
              </div>

              {/* Files List */}
              <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {gitLoading && !gitStatus ? (
                  <div style={{ color: '#a1a1aa', fontSize: '12px', textAlign: 'center', padding: '24px 0' }}>
                    Đang quét thay đổi...
                  </div>
                ) : !hasChanges ? (
                  <div style={{
                    margin: '8px 0',
                    background: '#141416',
                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    padding: '28px 16px',
                    textAlign: 'center',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#a1a1aa',
                    lineHeight: 1.5
                  }}>
                    Không có thay đổi nào được phát hiện.
                  </div>
                ) : (
                  gitStatus?.changedFiles.map((line, idx) => {
                    const { code, path: filePath } = parseGitStatusLine(line);
                    const badge = getStatusBadge(code);
                    const isChecked = checkedFiles[filePath] || false;
                    const isFileDiscarding = isDiscardingFile[filePath] || false;

                    return (
                      <div
                        key={idx}
                        className="git-file-row"
                        onClick={() => setSelectedDiffFile(filePath)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease',
                          gap: '8px',
                          justifyContent: 'space-between',
                          userSelect: 'none',
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleFile(filePath)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ cursor: 'pointer' }}
                          />
                          
                          {/* Biểu tượng File */}
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2" style={{ flexShrink: 0 }}>
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                            <polyline points="13 2 13 9 20 9" />
                          </svg>

                          {/* Tên File */}
                          <div
                            style={{
                              fontSize: '12.5px',
                              fontWeight: 500,
                              color: '#e4e4e7',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1
                            }}
                            title={filePath}
                          >
                            {filePath.split('/').pop()}
                            <span style={{ fontSize: '11px', fontWeight: 500, color: '#a1a1aa', marginLeft: '6px' }}>
                              {filePath.substring(0, filePath.lastIndexOf('/'))}
                            </span>
                          </div>
                        </div>

                        {/* Badge Trạng thái & Hover Actions */}
                        <div className="git-actions-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {/* Hover action buttons */}
                          <div className="git-hover-actions" style={{ display: 'none', alignItems: 'center', gap: '4px' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDiffFile(filePath);
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#a1a1aa',
                                cursor: 'pointer',
                                padding: '2px 4px',
                                borderRadius: '3px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title="Xem Diff"
                              onMouseEnter={(e) => e.currentTarget.style.color = '#e4e4e7'}
                              onMouseLeave={(e) => e.currentTarget.style.color = '#a1a1aa'}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="16 18 22 12 16 6" />
                                <polyline points="8 6 2 12 8 18" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => handleDiscardFile(e, filePath)}
                              disabled={isFileDiscarding}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: '2px 4px',
                                borderRadius: '3px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title="Hủy thay đổi"
                              onMouseEnter={(e) => e.currentTarget.style.color = '#f87171'}
                              onMouseLeave={(e) => e.currentTarget.style.color = '#ef4444'}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M3 6h18" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>

                          {/* Badge 1-char — 9px OK per skill (chip exception) */}
                          <span
                            className="git-status-badge"
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              width: '16px',
                              height: '16px',
                              borderRadius: '3px',
                              color: badge.color,
                              background: badge.bg,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title={badge.label}
                          >
                            {badge.char}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* CSS Hovers */}
      <style>{`
        .git-file-row:hover {
          background-color: rgba(255, 255, 255, 0.04);
        }
        .git-file-row:hover .git-status-badge {
          display: none !important;
        }
        .git-file-row:hover .git-hover-actions {
          display: flex !important;
        }
      `}</style>
    </div>
  );
}
