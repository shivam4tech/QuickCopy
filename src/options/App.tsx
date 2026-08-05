import { useState, useEffect, useCallback, useRef } from 'react';
import { EXTENSION_NAME, EXTENSION_VERSION } from '@shared/constants';
import { colors, spacing, fonts, fontSizes, fontWeights } from '@styles/designSystem';
import { Card, CardBody } from '@components/ui/Card';
import { Switch } from '@components/ui/Switch';
import { Select } from '@components/ui/Select';
import { useSettings } from '@hooks/useSettings';
import { LANGUAGES, getLanguageByCode, type InstalledLanguage } from '@type/language';
import { languageManager, type DownloadProgress } from '@services/ocr/LanguageManager';

const styles = {
  page: {
    maxWidth: 720,
    margin: '0 auto',
    padding: spacing[8],
    fontFamily: fonts.sans,
    color: colors.text.primary,
    background: colors.bg.primary,
    minHeight: '100vh',
  } as const,
  header: {
    marginBottom: spacing[8],
  } as const,
  title: {
    fontSize: fontSizes['3xl'],
    fontWeight: fontWeights.bold,
    marginBottom: spacing[1],
  } as const,
  subtitle: {
    fontSize: fontSizes.base,
    color: colors.text.muted,
  } as const,
  section: {
    marginBottom: spacing[6],
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
    padding: `${spacing[3]} 0`,
    borderBottom: `1px solid ${colors.border.muted}`,
  } as const,
  settingLabel: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
  } as const,
  settingDesc: {
    fontSize: fontSizes.sm,
    color: colors.text.muted,
    marginTop: spacing[0.5],
  } as const,
  footer: {
    marginTop: spacing[12],
    paddingTop: spacing[6],
    borderTop: `1px solid ${colors.border.muted}`,
    textAlign: 'center' as const,
    color: colors.text.muted,
    fontSize: fontSizes.sm,
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
  removeBtn: {
    background: 'none',
    border: 'none',
    color: colors.accent.error,
    fontSize: fontSizes.xs,
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
  } as const,
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  } as const,
  modalCard: {
    width: 340,
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
    borderRadius: '6px',
    padding: `${spacing[1.5]} ${spacing[3]}`,
    fontSize: fontSizes.sm,
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as const,
  btnPrimary: {
    background: colors.accent.primary,
    border: 'none',
    color: colors.text.inverse,
    borderRadius: '6px',
    padding: `${spacing[1.5]} ${spacing[3]}`,
    fontSize: fontSizes.sm,
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as const,
  radioGroup: {
    margin: `${spacing[2]} 0`,
  } as const,
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    padding: `${spacing[1]} 0`,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    cursor: 'pointer',
  } as const,
};

type ModalState = {
  type: 'download' | 'switch';
  langCode: string;
  langName: string;
  langSize: string;
  existingLang?: string;
  existingLangName?: string;
} | null;

export function App() {
  const { settings, updateSetting } = useSettings();
  const [installedLanguages, setInstalledLanguages] = useState<InstalledLanguage[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [switchKeep, setSwitchKeep] = useState(true);
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
    { label: 'None (English only)', value: 'none' },
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

        if (currentSecondary) {
          const existingLang = getLanguageByCode(currentSecondary);
          setModal({
            type: 'switch',
            langCode: newCode,
            langName: lang.name,
            langSize: lang.size,
            existingLang: currentSecondary,
            existingLangName: existingLang?.name ?? currentSecondary,
          });
          return;
        }

        setModal({
          type: 'download',
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

    if (modal.type === 'switch' && modal.existingLang && !switchKeep) {
      await languageManager.removeLanguage(modal.existingLang);
    }

    await loadInstalled();
    closeModal();
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
    if (downloadProgress.status === 'downloading') return `Downloading... ${downloadProgress.progress}%`;
    if (downloadProgress.status === 'complete') return 'Finished';
    return downloadProgress.error ?? 'Error';
  };

  const currentSecondaryName = settings.secondaryLanguage
    ? getLanguageByCode(settings.secondaryLanguage)?.name ?? settings.secondaryLanguage
    : 'None';

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>{EXTENSION_NAME} Settings</h1>
        <p style={styles.subtitle}>Configure your OCR copy extension</p>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>OCR</h2>
        <Card>
          <CardBody>
            <div style={styles.settingRow}>
              <div>
                <div style={styles.settingLabel}>OCR engine mode</div>
                <div style={styles.settingDesc}>Auto detects text vs code</div>
              </div>
              <Select
                value={settings.ocrMode}
                onChange={(v) => updateSetting('ocrMode', v as typeof settings.ocrMode)}
                options={[
                  { label: 'Auto', value: 'auto' },
                  { label: 'Tesseract only', value: 'text' },
                  { label: 'Auto + Debug', value: 'debug' },
                ]}
              />
            </div>
            <div style={styles.settingRow}>
              <div>
                <div style={styles.settingLabel}>Secondary language</div>
                <div style={styles.settingDesc}>English is always used. Add one more language for mixed text.</div>
              </div>
              <Select
                value={settings.secondaryLanguage ?? 'none'}
                onChange={handleLanguageChange}
                options={secondaryOptions}
              />
            </div>
            {downloadProgress && (
              <div style={{ marginTop: spacing[2] }}>
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progressFill, width: `${downloadProgress.progress}%` }} />
                </div>
                <div style={styles.progressText}>{getProgressLabel()}</div>
              </div>
            )}
            <div style={{ ...styles.settingRow, borderBottom: 'none', paddingBottom: 0 }}>
              <span style={{ fontSize: fontSizes.xs, color: colors.text.muted }}>
                Active: English + {currentSecondaryName === 'None' ? '(none)' : currentSecondaryName}.
                Using an additional language slightly increases OCR time because two recognition models are loaded.
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Installed Languages</h2>
        <p style={styles.sectionDesc}>
          Languages are stored locally in your browser. English is always built in.
        </p>
        {actionError && <p style={styles.modalError}>{actionError}</p>}
        <Card>
          <CardBody>
            <div style={{ ...styles.settingRow, fontSize: fontSizes.sm }}>
              <span style={{ color: colors.text.secondary }}>English</span>
              <span style={{ color: colors.text.muted, fontSize: fontSizes.xs }}>Built in</span>
            </div>
            {installedLanguages.map((lang) => {
              const info = getLanguageByCode(lang.code);
              return (
                <div key={lang.code} style={{ ...styles.settingRow, fontSize: fontSizes.sm }}>
                  <span style={{ color: colors.text.secondary }}>{info?.name ?? lang.code}</span>
                  <button
                    type="button"
                    style={styles.removeBtn}
                    onClick={() => handleRemoveLanguage(lang.code)}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
            {installedLanguages.length === 0 && (
              <div style={{ ...styles.settingRow, borderBottom: 'none', fontSize: fontSizes.sm }}>
                <span style={{ color: colors.text.muted }}>No additional languages installed yet.</span>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Copy Behavior</h2>
        <Card>
          <CardBody>
            <div style={styles.settingRow}>
              <div>
                <div style={styles.settingLabel}>Auto-copy</div>
                <div style={styles.settingDesc}>Automatically copy text after OCR completes</div>
              </div>
              <Switch
                checked={settings.autoCopy}
                onChange={(checked) => updateSetting('autoCopy', checked)}
              />
            </div>
            <div style={styles.settingRow}>
              <div>
                <div style={styles.settingLabel}>Show panel after capture</div>
                <div style={styles.settingDesc}>Show the QuickCopy panel after capturing; disable for silent drag-to-copy</div>
              </div>
              <Switch
                checked={settings.showPanel}
                onChange={(checked) => updateSetting('showPanel', checked)}
              />
            </div>
            <div style={styles.settingRow}>
              <div>
                <div style={styles.settingLabel}>Append newline on copy</div>
                <div style={styles.settingDesc}>End copied text with a newline so pasting lands on a fresh line; off copies without a trailing newline</div>
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
        <p style={styles.sectionDesc}>Version and license information.</p>
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
                <div style={styles.settingLabel}>Engine</div>
              </div>
              <span style={{ color: colors.text.muted }}>Tesseract.js</span>
            </div>
            <div style={styles.settingRow}>
              <div>
                <div style={styles.settingLabel}>License</div>
              </div>
              <span style={{ color: colors.text.muted }}>MIT</span>
            </div>
            <div style={{ ...styles.settingRow, borderBottom: 'none' }}>
              <div>
                <div style={styles.settingLabel}>Repository</div>
              </div>
              <a
                href="https://github.com/shivam4tech/QuickCopy"
                target="_blank"
                rel="noreferrer"
                style={{ color: colors.accent.primary, fontSize: fontSizes.sm }}
              >
                github.com/shivam4tech/QuickCopy
              </a>
            </div>
          </CardBody>
        </Card>
      </div>

      <div style={styles.footer}>
        <p>{EXTENSION_NAME} v{EXTENSION_VERSION} &mdash; MIT License</p>
      </div>

      {modal && (
        <div style={styles.modalOverlay} onClick={handleCancel}>
          <div onClick={(e) => e.stopPropagation()}>
            <Card style={styles.modalCard}>
              <CardBody>
                {modal.type === 'download' ? (
                  <>
                    <div style={styles.modalTitle}>Download {modal.langName} OCR?</div>
                    <div style={styles.modalBody}>
                      <div>Size: approximately {modal.langSize}</div>
                      <div>English OCR will continue to work.</div>
                      <div>{modal.langName} will be stored locally.</div>
                      <div>OCR may become slightly slower when using two languages.</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={styles.modalTitle}>Switch language?</div>
                    <div style={styles.modalBody}>
                      <div>{modal.langName} OCR is not installed.</div>
                      <div>{modal.existingLangName} OCR is already installed.</div>
                      <div style={styles.radioGroup}>
                        <label style={styles.radioLabel}>
                          <input
                            type="radio"
                            name="switch-lang"
                            checked={switchKeep}
                            onChange={() => setSwitchKeep(true)}
                          />
                          Keep {modal.existingLangName} installed
                        </label>
                        <label style={styles.radioLabel}>
                          <input
                            type="radio"
                            name="switch-lang"
                            checked={!switchKeep}
                            onChange={() => setSwitchKeep(false)}
                          />
                          Remove {modal.existingLangName} after {modal.langName} installs
                        </label>
                      </div>
                    </div>
                  </>
                )}
                {actionError && <div style={styles.modalError}>{actionError}</div>}
                {downloadProgress?.status === 'downloading' && (
                  <div style={{ marginBottom: spacing[3] }}>
                    <div style={styles.progressBar}>
                      <div style={{ ...styles.progressFill, width: `${downloadProgress.progress}%` }} />
                    </div>
                    <div style={styles.progressText}>{getProgressLabel()}</div>
                  </div>
                )}
                <div style={styles.modalActions}>
                  <button type="button" style={styles.btnSecondary} onClick={handleCancel}>
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
