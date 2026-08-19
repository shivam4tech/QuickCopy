import { useState, useEffect, useCallback, useRef } from 'react';
import { EXTENSION_NAME, EXTENSION_VERSION } from '@shared/constants';
import { colors, spacing, fonts, fontSizes, fontWeights } from '@styles/designSystem';
import type { ThemeMode } from '@type/index';
import { Card, CardBody } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import { Switch } from '@components/ui/Switch';
import { Select } from '@components/ui/Select';
import { Tooltip } from '@components/ui/Tooltip';
import { useSettings } from '@hooks/useSettings';
import { LANGUAGES, getLanguageByCode, type InstalledLanguage } from '@type/language';
import { languageManager, type DownloadProgress } from '@services/ocr/LanguageManager';

const styles = {
  page: {
    maxWidth: 880,
    margin: '0 auto',
    padding: `${spacing[12]} ${spacing[8]} ${spacing[16]}`,
    fontFamily: fonts.sans,
    color: colors.text.primary,
    minHeight: '100vh',
  } as const,
  header: {
    marginBottom: spacing[12],
  } as const,
  title: {
    fontSize: fontSizes['3xl'],
    fontWeight: fontWeights.bold,
    marginBottom: spacing[2],
  } as const,
  subtitle: {
    fontSize: fontSizes.base,
    color: colors.text.muted,
  } as const,
  section: {
    marginBottom: spacing[12],
  } as const,
  sectionTitle: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semibold,
    marginBottom: spacing[1],
  } as const,
  sectionDesc: {
    fontSize: fontSizes.sm,
    color: colors.text.muted,
    marginBottom: spacing[4],
  } as const,
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[4],
    padding: `${spacing[4]} 0`,
    borderBottom: `1px solid ${colors.border.muted}`,
    minHeight: 52,
  } as const,
  settingText: {
    flex: 1,
    minWidth: 0,
  } as const,
  settingLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[1.5],
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
  } as const,
  settingDesc: {
    fontSize: fontSizes.sm,
    color: colors.text.muted,
    marginTop: spacing[1],
  } as const,
  statusLine: {
    paddingTop: spacing[3],
    fontSize: fontSizes.xs,
    color: colors.text.muted,
  } as const,
  langRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    padding: `${spacing[3]} 0`,
    borderBottom: `1px solid ${colors.border.muted}`,
    minHeight: 48,
  } as const,
  langInfo: {
    display: 'flex',
    alignItems: 'baseline',
    gap: spacing[2],
    minWidth: 0,
  } as const,
  langName: {
    fontSize: fontSizes.base,
    color: colors.text.primary,
  } as const,
  langSize: {
    fontSize: fontSizes.xs,
    color: colors.text.muted,
  } as const,
  setAdditionalBtn: {
    background: 'none',
    border: `1px solid ${colors.border.default}`,
    color: colors.accent.primary,
    fontSize: fontSizes.xs,
    cursor: 'pointer',
    padding: `${spacing[1]} ${spacing[2.5]}`,
    borderRadius: '6px',
    fontFamily: 'inherit',
    minHeight: 32,
    transition: 'border-color 100ms ease',
  } as const,
  removeBtn: {
    background: 'none',
    border: 'none',
    color: colors.accent.error,
    fontSize: fontSizes.sm,
    cursor: 'pointer',
    padding: `${spacing[1.5]} ${spacing[2]}`,
    borderRadius: '6px',
    fontFamily: 'inherit',
    minHeight: 36,
  } as const,
  storageLine: {
    display: 'flex',
    alignItems: 'center',
    paddingTop: spacing[3],
    fontSize: fontSizes.xs,
    color: colors.text.muted,
  } as const,
  progressBar: {
    marginTop: spacing[2],
    height: 4,
    background: colors.bg.tertiary,
    borderRadius: '9999px',
    overflow: 'hidden',
  } as const,
  progressFill: {
    height: '100%',
    background: colors.accent.primary,
    transition: 'width 0.2s',
  } as const,
  progressText: {
    marginTop: spacing[1],
    fontSize: fontSizes.xs,
    color: colors.text.muted,
  } as const,
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: colors.overlay,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  } as const,
  modalCard: {
    width: 360,
    margin: spacing[4],
  } as const,
  modalTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    marginBottom: spacing[2],
  } as const,
  modalBody: {
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    marginBottom: spacing[4],
    lineHeight: 1.6,
  } as const,
  modalError: {
    fontSize: fontSizes.sm,
    color: colors.accent.error,
    marginBottom: spacing[3],
  } as const,
  modalActions: {
    display: 'flex',
    gap: spacing[2],
    justifyContent: 'flex-end',
  } as const,
  btnSecondary: {
    background: 'none',
    border: `1px solid ${colors.border.default}`,
    color: colors.text.secondary,
    borderRadius: '8px',
    padding: `${spacing[2]} ${spacing[4]}`,
    fontSize: fontSizes.sm,
    cursor: 'pointer',
    fontFamily: 'inherit',
    minHeight: 36,
  } as const,
  btnPrimary: {
    background: colors.accent.primary,
    border: 'none',
    color: colors.text.inverse,
    borderRadius: '8px',
    padding: `${spacing[2]} ${spacing[4]}`,
    fontSize: fontSizes.sm,
    cursor: 'pointer',
    fontFamily: 'inherit',
    minHeight: 36,
    fontWeight: fontWeights.medium,
  } as const,
};

type ModalState = {
  langCode: string;
  langName: string;
  langSize: string;
} | null;

/** eng.traineddata shipped with the extension (~4.1 MB stored on device). */
const ENGLISH_SIZE_MB = 4.1;

/** Parse a catalog size string like '1.5 MB' into a decimal MB number. */
function parseSizeMb(size: string): number {
  const match = /^([\d.]+)\s*MB$/i.exec(size.trim());
  return match ? parseFloat(match[1] ?? '0') : 0;
}

export function App() {
  const { settings, updateSetting } = useSettings();
  const isMac = /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
  const [installedLanguages, setInstalledLanguages] = useState<InstalledLanguage[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const cancelRequested = useRef(false);

  const closeModal = () => {
    setModal(null);
    setDownloadProgress(null);
    setActionError(null);
  };

  const loadInstalled = useCallback(async () => {
    setInstalledLanguages(await languageManager.getInstalledLanguages());
  }, []);

  useEffect(() => {
    loadInstalled();
  }, [loadInstalled]);

  const secondaryOptions = [
    { label: 'None', value: 'none' },
    ...LANGUAGES.map((l) => ({ label: l.name, value: l.code })),
  ];

  const handleLanguageChange = async (value: string) => {
    setActionError(null);
    const newCode = value === 'none' ? null : value;
    const currentSecondary = settings.secondaryLanguage;

    if (newCode === currentSecondary) return;

    if (newCode) {
      if (!(await languageManager.isLanguageInstalled(newCode))) {
        const lang = getLanguageByCode(newCode);
        if (!lang) return;

        setModal({
          langCode: newCode,
          langName: lang.name,
          langSize: lang.size,
        });
        return;
      }

      await updateSetting('secondaryLanguage', newCode);
      return;
    }

    await updateSetting('secondaryLanguage', null);
  };

  const handleDownloadConfirm = async () => {
    if (!modal) return;
    cancelRequested.current = false;
    setActionError(null);
    setDownloadProgress({ status: 'downloading', progress: 0 });

    const ok = await languageManager.downloadLanguage(modal.langCode, (p) => {
      setDownloadProgress(p);
    });

    if (cancelRequested.current) {
      closeModal();
      return;
    }

    if (!ok) {
      setActionError('Download failed. Check your internet connection and try again.');
      setDownloadProgress(null);
      return;
    }

    await updateSetting('secondaryLanguage', modal.langCode);
    await loadInstalled();
    setDownloadProgress({ status: 'complete', progress: 100 });
    window.setTimeout(closeModal, 900);
  };

  const handleCancel = () => {
    cancelRequested.current = true;
    languageManager.cancelDownload();
    closeModal();
  };

  const handleRemoveLanguage = async (code: string) => {
    setActionError(null);
    await languageManager.removeLanguage(code);
    if (settings.secondaryLanguage === code) {
      await updateSetting('secondaryLanguage', null);
    }
    await loadInstalled();
  };

  const getProgressLabel = () => {
    if (!downloadProgress) return '';
    if (downloadProgress.status === 'downloading') {
      return `Downloading ${modal?.langName ?? 'language'}... ${downloadProgress.progress}%`;
    }
    if (downloadProgress.status === 'complete') return `${modal?.langName ?? 'Language'} is ready to use.`;
    return downloadProgress.error ?? 'Download failed.';
  };

  const currentSecondaryName = settings.secondaryLanguage
    ? getLanguageByCode(settings.secondaryLanguage)?.name ?? settings.secondaryLanguage
    : null;

  const storageMb = installedLanguages.reduce((mb, lang) => {
    const info = getLanguageByCode(lang.code);
    return mb + (info ? parseSizeMb(info.size) : lang.size / (1024 * 1024));
  }, ENGLISH_SIZE_MB);

  const handleSetAdditional = async (code: string) => {
    setActionError(null);
    await updateSetting('secondaryLanguage', code);
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>{EXTENSION_NAME}</h1>
        <p style={styles.subtitle}>
          Make any text on your screen copyable — 100% on your device, nothing ever leaves it.
        </p>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Capture Shortcut</h2>
        <p style={styles.sectionDesc}>The modifier key used with Drag to capture text.</p>
        <Card>
          <CardBody>
            <div style={{ ...styles.settingRow, borderBottom: 'none' }}>
              <div style={styles.settingText}>
                <div style={styles.settingLabel}>
                  Drag Modifier
                  <Tooltip text="Hold the chosen modifier with the Left Mouse button while dragging over text to capture it. Both options work in Chrome and Firefox." />
                </div>
                <div style={styles.settingDesc}>
                  {isMac
                    ? 'Drag with the Left Mouse button while holding Option+Shift to capture — works on every platform. Note: Cmd+drag on a link prevents it from opening in a new tab in both Chrome and Firefox; capturing still works, and if it ever gets in the way, switch to Option+Shift or turn the extension off from the popup.'
                    : 'Drag with the Left Mouse button while holding Alt+Shift to capture — works on every platform. Note: Ctrl+drag on a link prevents it from opening in a new tab in both Chrome and Firefox; capturing still works, and if it ever gets in the way, switch to Alt+Shift or turn the extension off from the popup.'}
                </div>
              </div>
              <Select
                value={settings.dragModifier}
                onChange={(v) => updateSetting('dragModifier', v as 'ctrl' | 'alt+shift')}
                options={[
                  { label: `${isMac ? 'Option' : 'Alt'} + Shift + Drag (default)`, value: 'alt+shift' },
                  { label: `${isMac ? 'Cmd' : 'Ctrl'} + Drag`, value: 'ctrl' },
                ]}
              />
            </div>
          </CardBody>
        </Card>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Appearance</h2>
        <p style={styles.sectionDesc}>Choose how Ekadanta looks across the settings page, popup and capture panel.</p>
        <Card>
          <CardBody>
            <div style={{ ...styles.settingRow, borderBottom: 'none' }}>
              <div style={styles.settingText}>
                <div style={styles.settingLabel}>Theme</div>
                <div style={styles.settingDesc}>
                  System follows your device's color scheme.
                </div>
              </div>
              <Select
                value={settings.theme}
                onChange={(v) => updateSetting('theme', v as ThemeMode)}
                options={[
                  { label: 'Dark', value: 'dark' },
                  { label: 'Light', value: 'light' },
                  { label: 'System', value: 'system' },
                ]}
              />
            </div>
          </CardBody>
        </Card>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Text Recognition</h2>
        <p style={styles.sectionDesc}>How Ekadanta reads the text you select.</p>
        <Card>
          <CardBody>
            <div style={styles.settingRow}>
              <div style={styles.settingText}>
                <div style={styles.settingLabel}>
                  Recognition Mode
                  <Tooltip text="Automatic is recommended. Switch to Text only if recognition ever misses something you select." />
                </div>
                <div style={styles.settingDesc}>
                  Automatically chooses the best method for the text you select.
                </div>
              </div>
              <Select
                value={settings.ocrMode}
                onChange={(v) => updateSetting('ocrMode', v as typeof settings.ocrMode)}
                options={[
                  { label: 'Automatic (recommended)', value: 'auto' },
                  { label: 'Text only', value: 'text' },
                ]}
              />
            </div>
            <div style={styles.settingRow}>
              <div style={styles.settingText}>
                <div style={styles.settingLabel}>
                  Additional Language
                  <Tooltip text="Reading takes a little longer when an additional language is active." />
                </div>
                <div style={styles.settingDesc}>
                  Ekadanta always reads English. You can optionally add one more language.
                </div>
              </div>
              <Select
                value={settings.secondaryLanguage ?? 'none'}
                onChange={handleLanguageChange}
                options={secondaryOptions}
                searchable
              />
            </div>
            <div style={{ ...styles.settingRow, borderBottom: 'none', paddingBottom: 0 }}>
              <span style={styles.statusLine}>
                Currently reading: {currentSecondaryName ? `English + ${currentSecondaryName}` : 'English'}
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Downloaded Languages</h2>
        <p style={styles.sectionDesc}>Languages stored on this device. English is always included.</p>
        {actionError && <p style={styles.modalError}>{actionError}</p>}
        <Card>
          <CardBody>
            <div style={styles.langRow}>
              <div style={styles.langInfo}>
                <span style={styles.langName}>English</span>
                <span style={styles.langSize}>{ENGLISH_SIZE_MB} MB</span>
              </div>
              <Badge>Always available</Badge>
            </div>
            {installedLanguages.map((lang) => {
              const info = getLanguageByCode(lang.code);
              const isInUse = settings.secondaryLanguage === lang.code;
              return (
                <div key={lang.code} style={styles.langRow}>
                  <div style={styles.langInfo}>
                    <span style={styles.langName}>{info?.name ?? lang.code}</span>
                    {info && <span style={styles.langSize}>{info.size}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
                    {isInUse ? (
                      <Badge variant="success">In use</Badge>
                    ) : (
                      <button
                        type="button"
                        style={styles.setAdditionalBtn}
                        onClick={() => handleSetAdditional(lang.code)}
                      >
                        Set as additional
                      </button>
                    )}
                    <button
                      type="button"
                      style={styles.removeBtn}
                      onClick={() => handleRemoveLanguage(lang.code)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
            {installedLanguages.length === 0 && (
              <div style={{ ...styles.langRow, borderBottom: 'none' }}>
                <span style={{ color: colors.text.muted, fontSize: fontSizes.sm }}>
                  No additional languages downloaded yet.
                </span>
              </div>
            )}
            <div style={styles.storageLine}>Storage used: {storageMb.toFixed(1)} MB</div>
          </CardBody>
        </Card>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Copying</h2>
        <p style={styles.sectionDesc}>How copied text behaves.</p>
        <Card>
          <CardBody>
            <div style={styles.settingRow}>
              <div style={styles.settingText}>
                <div style={styles.settingLabel}>Automatically copy text</div>
                <div style={styles.settingDesc}>Copies text immediately after recognition.</div>
              </div>
              <Switch
                checked={settings.autoCopy}
                onChange={(checked) => updateSetting('autoCopy', checked)}
              />
            </div>
            <div style={styles.settingRow}>
              <div style={styles.settingText}>
                <div style={styles.settingLabel}>Show result window</div>
                <div style={styles.settingDesc}>Displays the copied text before closing.</div>
              </div>
              <Switch
                checked={settings.showPanel}
                onChange={(checked) => updateSetting('showPanel', checked)}
              />
            </div>
            <div style={styles.settingRow}>
              <div
                style={{
                  ...styles.settingText,
                  opacity: settings.showPanel ? 1 : 0.45,
                }}
              >
                <div style={styles.settingLabel}>Close result window after</div>
                <div style={styles.settingDesc}>
                  Closes the result window a while after copying finishes.
                </div>
              </div>
              <Select
                value={settings.panelDismissSeconds.toString()}
                onChange={(v) => updateSetting('panelDismissSeconds', Number(v))}
                disabled={!settings.showPanel}
                options={[
                  { label: 'Never (stay open)', value: '0' },
                  { label: '2 seconds', value: '2' },
                  { label: '5 seconds', value: '5' },
                  { label: '10 seconds', value: '10' },
                  { label: '15 seconds', value: '15' },
                  { label: '30 seconds', value: '30' },
                  { label: '1 minute', value: '60' },
                ]}
              />
            </div>
            <div style={{ ...styles.settingRow, borderBottom: 'none' }}>
              <div style={styles.settingText}>
                <div style={styles.settingLabel}>Append newline</div>
                <div style={styles.settingDesc}>Adds a new line after copied text.</div>
              </div>
              <Switch
                checked={settings.appendNewline}
                onChange={(checked) => updateSetting('appendNewline', checked)}
              />
            </div>
          </CardBody>
        </Card>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>About</h2>
        <p style={styles.sectionDesc}>
          Ekadanta is free, open source, and private by design — it collects no data, ever.
        </p>
        <Card>
          <CardBody>
            <div style={styles.settingRow}>
              <div>
                <div style={styles.settingLabel}>Version</div>
              </div>
              <span style={{ color: colors.text.muted }}>{EXTENSION_VERSION}</span>
            </div>
            <div style={styles.settingRow}>
              <div>
                <div style={styles.settingLabel}>Privacy</div>
              </div>
              <span style={{ color: colors.text.muted, fontSize: fontSizes.sm, textAlign: 'right' }}>
                No data collected — everything stays on your device
              </span>
            </div>
            <div style={styles.settingRow}>
              <div>
                <div style={styles.settingLabel}>License</div>
              </div>
              <span style={{ color: colors.text.muted }}>MIT</span>
            </div>
            <div style={styles.settingRow}>
              <div>
                <div style={styles.settingLabel}>Repository</div>
              </div>
              <a
                href="https://github.com/shivam4tech/Ekadanta"
                target="_blank"
                rel="noreferrer"
                style={{ color: colors.accent.primary, fontSize: fontSizes.sm }}
              >
                github.com/shivam4tech/Ekadanta
              </a>
            </div>
            <div style={{ ...styles.settingRow, borderBottom: 'none' }}>
              <div>
                <div style={styles.settingLabel}>Enjoying Ekadanta?</div>
                <div style={styles.settingDesc}>It is free and open source. A star helps more people find it.</div>
              </div>
              <a
                href="https://github.com/shivam4tech/Ekadanta"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: spacing[1.5],
                  color: colors.accent.primary,
                  fontSize: fontSizes.sm,
                  fontWeight: fontWeights.medium,
                  whiteSpace: 'nowrap',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Star on GitHub
              </a>
            </div>
          </CardBody>
        </Card>
      </div>

      {modal && (
        <div style={styles.modalOverlay} onClick={handleCancel}>
          <div onClick={(e) => e.stopPropagation()}>
            <Card style={styles.modalCard}>
              <CardBody>
                <div style={styles.modalTitle}>Download {modal.langName}?</div>
                <div style={styles.modalBody}>
                  <div>Size: approximately {modal.langSize}</div>
                  <div>{modal.langName} will be stored on this device.</div>
                  <div>English will keep working.</div>
                  <div>Reading may take a little longer with two languages.</div>
                </div>
                {actionError && <div style={styles.modalError}>{actionError}</div>}
                {downloadProgress && (
                  <div style={{ marginBottom: spacing[3] }}>
                    <div style={styles.progressBar}>
                      <div style={{ ...styles.progressFill, width: `${downloadProgress.progress}%` }} />
                    </div>
                    <div style={styles.progressText}>{getProgressLabel()}</div>
                  </div>
                )}
                <div style={styles.modalActions}>
                  <button
                    type="button"
                    style={styles.btnSecondary}
                    onClick={handleCancel}
                    disabled={downloadProgress?.status === 'downloading'}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    style={styles.btnPrimary}
                    onClick={handleDownloadConfirm}
                    disabled={downloadProgress?.status === 'downloading'}
                  >
                    Download
                  </button>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
