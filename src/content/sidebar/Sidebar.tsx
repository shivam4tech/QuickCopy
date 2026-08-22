import { useState, useCallback, useEffect, useRef } from 'react';
import { colors, spacing, radius, fonts, fontSizes, fontWeights, shadows, animation } from '@styles/designSystem';
import { Button } from '@components/ui/Button';
import { eventBus } from '@utils/eventBus';
import { STORAGE_KEYS } from '@shared/constants';
import { defaultSettings, type ExtensionSettings } from '@type/settings';
import type { OcrResult } from '@type/index';
import { clipboardService } from '@services/ClipboardService';

interface SidebarProps {
  onClose: () => void;
  /**
   * Keeps the panel mounted: disables the auto-dismiss timer (used by the PDF
   * capture window, where the panel is a persistent results tray and the
   * auto-close/re-mount cycle would visibly "double-load" the panel on the
   * next drag).
   */
  persistent?: boolean;
}

interface OcrDisplayData {
  text: string;
  confidence: number;
  duration: number;
  engine?: OcrResult['engine'];
  fromPdf?: boolean;
}

const SIDEBAR_EXPAND_EVENT = 'ekadanta:sidebar:set-expanded';
const SIDEBAR_STATE_EVENT = 'ekadanta:sidebar:expanded-changed';

function engineLabel(engine: NonNullable<OcrResult['engine']>): string {
  const engineName = engine.provider === 'codeocr' ? 'Code OCR' : 'Tesseract';
  const suffix = engine.retried ? ' (retry)' : engine.fallbackUsed ? ' (fallback)' : '';
  return `${engineName}${suffix}`;
}

type StatusVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

const statusColors: Record<StatusVariant, string> = {
  default: colors.text.muted,
  success: colors.accent.success,
  warning: colors.accent.warning,
  error: colors.accent.error,
  info: colors.accent.info,
};

const Logo = ({ size = 18 }: { size?: number }) => (
  <img
    src={chrome.runtime.getURL('icons/icon32.png')}
    width={size}
    height={size}
    alt=""
    style={{ display: 'block', borderRadius: 4 }}
  />
);

export function Sidebar({ onClose, persistent = false }: SidebarProps) {
  const [expanded, setExpanded] = useState(true);
  const [closing, setClosing] = useState(false);
  const [ocrData, setOcrData] = useState<OcrDisplayData | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [copying, setCopying] = useState(false);
  const setBusy = useState(false)[1];
  const [status, setStatus] = useState<{ label: string; variant: StatusVariant }>({
    label: 'Select text to capture',
    variant: 'info',
  });
  const hoverRef = useRef(false);
  const editingRef = useRef(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  const panelRef = useRef<HTMLDivElement>(null);
  const editHeightRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const announceExpanded = useCallback((value: boolean) => {
    window.dispatchEvent(new CustomEvent(SIDEBAR_STATE_EVENT, { detail: value }));
  }, []);

  const clearDismissTimerRef = useCallback(() => {
    if (dismissTimer.current !== null) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, []);

  const handleExpand = useCallback((value: boolean) => {
    if (!value) clearDismissTimerRef();
    setExpanded(value);
    announceExpanded(value);
    setClosing(!value);
  }, [announceExpanded, clearDismissTimerRef]);

  useEffect(() => {
    announceExpanded(expanded);
  }, [expanded, announceExpanded]);

  const handleClose = useCallback(() => {
    clearDismissTimerRef();
    onCloseRef.current();
  }, [clearDismissTimerRef]);

  const handleCaptureStarted = useCallback(() => {
    clearDismissTimerRef();
    setOcrData(null);
    setEditing(false);
    editingRef.current = false;
    setBusy(true);
    setStatus({ label: 'Capturing…', variant: 'info' });
    handleExpand(true);
  }, [clearDismissTimerRef, handleExpand]);

  useEffect(() => {
    const unsubPostProc = eventBus.on('postprocessing:completed', (result: OcrResult) => {
      clearDismissTimerRef();
      setOcrData({
        text: result.text,
        confidence: result.confidence,
        duration: result.duration,
        engine: result.engine,
        fromPdf: result.fromPdf,
      });
      setEditText(result.text);
      setEditing(false);
      editingRef.current = false;
      setBusy(false);
      setStatus({ label: 'Ready to copy', variant: 'success' });
      handleExpand(true);
    });

    const unsubCaptureStarted = eventBus.on('capture:started', handleCaptureStarted);

    const unsubOcrFailed = eventBus.on('ocr:failed', () => {
      setBusy(false);
      setStatus({ label: 'Error', variant: 'error' });
    });

    const unsubClipOk = eventBus.on('clipboard:written', (success: boolean) => {
      if (success) {
        setStatus({ label: 'Copied!', variant: 'success' });
        clearDismissTimerRef();
        if (persistent) return;
        void chrome.storage.local
          .get({ [STORAGE_KEYS.SETTINGS]: defaultSettings })
          .then((res) => {
            const settings = res[STORAGE_KEYS.SETTINGS] as ExtensionSettings;
            const seconds = settings.panelDismissSeconds > 0 ? settings.panelDismissSeconds : 0;
            if (seconds === 0) return;
            dismissTimer.current = setTimeout(() => {
              if (!editingRef.current) handleClose();
            }, seconds * 1000);
          })
          .catch(() => {
            dismissTimer.current = setTimeout(() => {
              if (!editingRef.current) handleClose();
            }, 5000);
          });
      }
    });

    const unsubOverlayShown = eventBus.on('overlay:shown', () => {
      clearDismissTimerRef();
    });

    const unsubClipFail = eventBus.on('clipboard:failed', () => {
      setStatus({ label: 'Copy failed', variant: 'error' });
    });

    const unsubStatus = eventBus.on('status:update', (update: { status: string; message?: string }) => {
      setStatus(prev => ({
        label: update.status === 'error' ? 'Error' : (update.message ?? prev.label),
        variant: update.status === 'error' ? 'error' : update.status === 'ready' ? 'success' : 'info',
      }));
    });

    const onSetExpanded = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      handleExpand(detail);
    };
    window.addEventListener(SIDEBAR_EXPAND_EVENT, onSetExpanded);

    return () => {
      unsubPostProc();
      unsubCaptureStarted();
      unsubOcrFailed();
      unsubClipOk();
      unsubOverlayShown();
      unsubClipFail();
      unsubStatus();
      window.removeEventListener(SIDEBAR_EXPAND_EVENT, onSetExpanded);
      clearDismissTimerRef();
    };
  }, [handleExpand, handleCaptureStarted, clearDismissTimerRef, handleClose]);

  const handleCopy = useCallback(async () => {
    setCopying(true);
    const text = editing ? editText : (ocrData?.text ?? '');
    await clipboardService.copy(text);
    clearDismissTimerRef();
    setCopying(false);
  }, [editing, editText, ocrData, clearDismissTimerRef]);

  const startEditing = useCallback(() => {
    if (ocrData) {
      clearDismissTimerRef();
      const base = panelRef.current?.offsetHeight;
      if (base && base > 0) {
        const target = Math.min(base * 1.6, window.innerHeight - 24);
        editHeightRef.current = `${Math.max(target, base)}px`;
      }
      setEditText(ocrData.text);
      setEditing(true);
      editingRef.current = true;
    }
  }, [ocrData, clearDismissTimerRef]);

  const finishEditing = useCallback(() => {
    if (editingRef.current) {
      setOcrData(prev => (prev ? { ...prev, text: editText } : prev));
      setEditing(false);
      editingRef.current = false;
    }
  }, [editText]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      finishEditing();
    } else if (e.key === 'Escape') {
      setEditText(ocrData?.text ?? '');
      setEditing(false);
      editingRef.current = false;
    }
  }, [finishEditing, ocrData]);

  const confidenceLabel = ocrData
    ? ocrData.confidence >= 90 ? 'High' : ocrData.confidence >= 70 ? 'Medium' : 'Low'
    : '';
  const confidenceVariant: StatusVariant = ocrData
    ? ocrData.confidence >= 90 ? 'success' : ocrData.confidence >= 70 ? 'warning' : 'error'
    : 'default';
  const confidenceColor = ocrData ? statusColors[confidenceVariant] : colors.text.muted;

  const boxShadow = `0 0 0 1px ${colors.border.muted}, ${expanded ? shadows.xl : shadows.lg}`;

  return (
    <div
      onMouseEnter={() => { hoverRef.current = true; }}
      onMouseLeave={() => { hoverRef.current = false; }}
      style={{
        position: 'fixed',
        zIndex: 2147483647,
        fontFamily: fonts.sans,
        color: colors.text.primary,
        lineHeight: 'normal',
      }}
    >
      {expanded || closing ? (
        <div
          ref={panelRef}
          onAnimationEnd={(e) => {
            if (closing && e.animationName === 'qc-pop-out') {
              setClosing(false);
            }
          }}
          style={{
            position: 'fixed',
            top: 10,
            right: 10,
            width: 280,
            height: editing ? editHeightRef.current : undefined,
            maxHeight: editing ? editHeightRef.current : 'min(36vh, 294px)',
            display: 'flex',
            flexDirection: 'column',
            background: colors.bg.secondary,
            border: `1px solid ${colors.border.default}`,
            borderRadius: radius['2xl'],
            boxShadow: boxShadow,
            overflow: 'hidden',
            transformOrigin: 'top right',
            transition: `height ${animation.duration.fast} ${animation.easing.ease}, max-height ${animation.duration.fast} ${animation.easing.ease}`,
            animation: closing
              ? `qc-pop-out ${animation.duration.slow} ${animation.easing.easeIn} forwards`
              : `qc-pop ${animation.duration.slower} ${animation.easing.spring}`,
          }}
        >
          <style>{`
            @keyframes qc-pop {
              from { opacity: 0; transform: scale(0.92) translateX(22px); }
              to { opacity: 1; transform: scale(1) translateX(0); }
            }
            @keyframes qc-pop-out {
              from { opacity: 1; transform: scale(1) translateX(0); }
              to { opacity: 0; transform: scale(0.92) translateX(22px); }
            }
            @keyframes qc-fade-in {
              from { opacity: 0; transform: scale(0.9); }
              to { opacity: 1; transform: scale(1); }
            }
            @keyframes qc-spin {
              to { transform: rotate(360deg); }
            }
          `}</style>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing[2],
              padding: `${spacing[2.5]} ${spacing[3]}`,
              borderBottom: `1px solid ${colors.border.default}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], minWidth: 0 }}>
              <Logo size={18} />
              <span style={{ fontSize: fontSizes.base, fontWeight: fontWeights.semibold, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                Pluk
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1.5] }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  maxWidth: 120,
                  flexShrink: 1,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: statusColors[status.variant],
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: fontSizes.xs,
                    fontFamily: fonts.mono,
                    color: status.variant === 'default' ? colors.text.secondary : statusColors[status.variant],
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {status.label}
                </span>
              </span>
              <IconButton onClick={() => handleExpand(false)} title="Minimize">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </IconButton>
              <IconButton onClick={handleClose} title="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </IconButton>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: spacing[3],
              display: 'flex',
              flexDirection: 'column',
              gap: spacing[2.5],
            }}
          >
            {ocrData ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' }}>
                  <span style={{ fontSize: fontSizes.xs, fontFamily: fonts.mono, fontWeight: fontWeights.medium, color: confidenceColor }}>
                    {confidenceLabel} · {ocrData.confidence.toFixed(0)}%
                  </span>
                  <span style={{ fontSize: fontSizes.xs, fontFamily: fonts.mono, color: colors.text.muted }}>
                    {ocrData.text.length} chars{ocrData.duration ? ` · ${(ocrData.duration / 1000).toFixed(1)}s` : ''}
                    {ocrData.engine ? ` · ${engineLabel(ocrData.engine)}` : ''}
                  </span>
                </div>

                {editing ? (
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    onFocus={(e) => (e.currentTarget.style.borderColor = colors.border.active)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = colors.border.default)}
                    autoFocus
                    spellCheck={false}
                    style={{
                      width: '100%',
                      minHeight: 100,
                      flex: 1,
                      background: colors.bg.tertiary,
                      color: colors.text.primary,
                      border: `1px solid ${colors.border.default}`,
                      borderRadius: radius.md,
                      padding: spacing[2.5],
                      fontSize: fontSizes.base,
                      fontFamily: fonts.mono,
                      lineHeight: 1.6,
                      resize: 'none',
                      outline: 'none',
                      overflowY: 'auto',
                      overflowX: 'hidden',
                    }}
                  />
                ) : (
                  <div
                    onClick={startEditing}
                    title="Click to edit"
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = colors.border.hover)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = colors.border.default)}
                    style={{
                      fontSize: fontSizes.base,
                      color: colors.text.secondary,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      cursor: 'pointer',
                      padding: spacing[2],
                      borderRadius: radius.md,
                      background: colors.bg.tertiary,
                      maxHeight: '18vh',
                      overflowY: 'auto',
                      transition: `border-color ${animation.duration.fast} ${animation.easing.ease}`,
                      border: `1px solid ${colors.border.default}`,
                    }}
                  >
                    {ocrData.text || <span style={{ color: colors.text.muted }}>(empty result)</span>}
                  </div>
                )}

                {ocrData.fromPdf && (
                  <span
                    style={{
                      display: 'block',
                      fontSize: fontSizes.xs,
                      color: colors.accent.info,
                      background: colors.accentSoft.info,
                      borderRadius: radius.sm,
                      padding: `${spacing[1.5]} ${spacing[2]}`,
                      lineHeight: 1.45,
                    }}
                  >
                    PDF capture accuracy can vary — always verify the text against the document.
                  </span>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing[2], padding: `${spacing[4]} ${spacing[4]}` }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.accent.primary} strokeWidth="2" style={{ animation: 'qc-spin 0.8s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" opacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                <span style={{ fontSize: fontSizes.sm, color: colors.text.secondary }}>{status.label}</span>
              </div>
            )}
          </div>

          <div
            style={{
              padding: `${spacing[2.5]} ${spacing[3]}`,
              borderTop: `1px solid ${colors.border.default}`,
              display: 'flex',
              gap: spacing[2],
            }}
          >
            <Button
              variant="primary"
              size="sm"
              style={{ flex: 1 }}
              disabled={!ocrData}
              loading={copying}
              onClick={handleCopy}
            >
              {copying ? 'Copying…' : 'Copy'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleClose}
              title="Close panel"
            >
              Close
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => handleExpand(true)}
          title="Open Pluk"
          style={{
            position: 'fixed',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: 3,
            background: colors.bg.secondary,
            borderRadius: 999,
            boxShadow: `0 0 0 1px ${colors.border.default}, ${shadows.md}`,
            cursor: 'pointer',
            zIndex: 2147483647,
            animation: `qc-fade-in 240ms ${animation.easing.easeOut}`,
            transition: `transform ${animation.duration.normal} ${animation.easing.easeOut}, box-shadow ${animation.duration.normal} ${animation.easing.easeOut}`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-50%) scale(1.05)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-50%)'; }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              borderRadius: 999,
              background: colors.bg.tertiary,
              flexShrink: 0,
            }}
          >
            <Logo size={11} />
          </span>
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: statusColors[status.variant],
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: fontSizes.xs, fontWeight: fontWeights.medium, color: colors.text.secondary, paddingRight: 2 }}>
            Open
          </span>
        </button>
      )}
    </div>
  );
}

function IconButton({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: radius.md,
        color: colors.text.muted,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: `background ${animation.duration.fast} ${animation.easing.ease}`,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = colors.bg.hover; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}
