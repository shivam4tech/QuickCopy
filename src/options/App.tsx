import { useState } from 'react';
import { EXTENSION_NAME, EXTENSION_VERSION } from '@shared/constants';
import { colors, spacing, fonts, fontSizes, fontWeights } from '@styles/designSystem';
import { Card, CardBody } from '@components/ui/Card';
import { Switch } from '@components/ui/Switch';
import { Select } from '@components/ui/Select';
import { useSettings } from '@hooks/useSettings';

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
};

const languageOptions = [
  { label: 'English', value: 'eng' },
  { label: 'French', value: 'fra' },
  { label: 'German', value: 'deu' },
  { label: 'Spanish', value: 'spa' },
  { label: 'Italian', value: 'ita' },
  { label: 'Portuguese', value: 'por' },
  { label: 'Russian', value: 'rus' },
  { label: 'Japanese', value: 'jpn' },
  { label: 'Korean', value: 'kor' },
  { label: 'Chinese (Simplified)', value: 'chi_sim' },
];

const copyBehaviorOptions = [
  { label: 'Plain text only', value: 'plain' },
  { label: 'Preserve formatting', value: 'formatted' },
  { label: 'Smart (auto-detect)', value: 'smart' },
];

export function App() {
  const [theme, setTheme] = useState('dark');
  const [showConfirm, setShowConfirm] = useState(true);
  const [contextMenu, setContextMenu] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);
  const { settings, updateSetting } = useSettings();

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>{EXTENSION_NAME} Settings</h1>
        <p style={styles.subtitle}>Configure your OCR copy extension</p>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Appearance</h2>
        <p style={styles.sectionDesc}>Customize how QuickCopy looks in your browser.</p>
        <Card>
          <CardBody>
            <div style={styles.settingRow}>
              <div>
                <div style={styles.settingLabel}>Theme</div>
                <div style={styles.settingDesc}>Choose dark, light, or system theme</div>
              </div>
              <Select
                value={theme}
                onChange={setTheme}
                options={[
                  { label: 'Dark', value: 'dark' },
                  { label: 'Light', value: 'light' },
                  { label: 'System', value: 'system' },
                ]}
              />
            </div>
            <div style={styles.settingRow}>
              <div>
                <div style={styles.settingLabel}>Sidebar position</div>
                <div style={styles.settingDesc}>Show sidebar on the left or right</div>
              </div>
              <Select
                value="right"
                onChange={() => {}}
                options={[
                  { label: 'Right', value: 'right' },
                  { label: 'Left', value: 'left' },
                ]}
              />
            </div>
            <div style={{ ...styles.settingRow, borderBottom: 'none' }}>
              <div>
                <div style={styles.settingLabel}>Sidebar auto-hide duration</div>
                <div style={styles.settingDesc}>How long the sidebar stays visible (seconds)</div>
              </div>
              <Select
                value="10"
                onChange={() => {}}
                options={[
                  { label: '5s', value: '5' },
                  { label: '10s', value: '10' },
                  { label: '30s', value: '30' },
                  { label: 'Manual only', value: '0' },
                ]}
              />
            </div>
          </CardBody>
        </Card>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Shortcuts</h2>
        <p style={styles.sectionDesc}>Customize keyboard shortcuts.</p>
        <Card>
          <CardBody>
            <div style={styles.settingRow}>
              <div>
                <div style={styles.settingLabel}>Capture shortcut</div>
                <div style={styles.settingDesc}>Keyboard shortcut to start region capture</div>
              </div>
              <div style={{ color: colors.text.muted, fontSize: fontSizes.sm, fontFamily: fonts.mono }}>
                Alt+Shift+C
              </div>
            </div>
            <div style={{ ...styles.settingRow, borderBottom: 'none' }}>
              <div>
                <div style={styles.settingLabel}>Sidebar shortcut</div>
                <div style={styles.settingDesc}>Keyboard shortcut to toggle sidebar</div>
              </div>
              <div style={{ color: colors.text.muted, fontSize: fontSizes.sm, fontFamily: fonts.mono }}>
                Alt+Shift+S
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>OCR</h2>
        <p style={styles.sectionDesc}>Choose how QuickCopy recognizes text and code from screenshots.</p>
        <Card>
          <CardBody>
            <div style={styles.settingRow}>
              <div>
                <div style={styles.settingLabel}>OCR engine mode</div>
                <div style={styles.settingDesc}>Auto picks the best engine per capture; Code OCR is best for source code</div>
              </div>
              <Select
                value={settings.ocrMode}
                onChange={(v) => updateSetting('ocrMode', v as typeof settings.ocrMode)}
                options={[
                  { label: 'Auto', value: 'auto' },
                  { label: 'Fast text (Tesseract only)', value: 'text' },
                  { label: 'Code OCR (PP-OCRv5 only)', value: 'code' },
                  { label: 'Auto + Debug', value: 'debug' },
                ]}
              />
            </div>
            <div style={styles.settingRow}>
              <div>
                <div style={styles.settingLabel}>Recognition language</div>
                <div style={styles.settingDesc}>Primary language for OCR</div>
              </div>
              <Select
                value="eng"
                onChange={() => {}}
                options={languageOptions}
              />
            </div>
            <div style={{ ...styles.settingRow, borderBottom: 'none' }}>
              <div>
                <div style={styles.settingLabel}>Multiple languages</div>
                <div style={styles.settingDesc}>Enable multi-language detection (coming soon)</div>
              </div>
              <Switch checked={false} onChange={() => {}} />
            </div>
          </CardBody>
        </Card>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Copy Behavior</h2>
        <p style={styles.sectionDesc}>Control how recognized text is copied.</p>
        <Card>
          <CardBody>
            <div style={styles.settingRow}>
              <div>
                <div style={styles.settingLabel}>Copy format</div>
                <div style={styles.settingDesc}>How text is formatted when copied</div>
              </div>
              <Select
                value="smart"
                onChange={() => {}}
                options={copyBehaviorOptions}
              />
            </div>
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
            <div style={{ ...styles.settingRow, borderBottom: 'none' }}>
              <div>
                <div style={styles.settingLabel}>Show confirmation</div>
                <div style={styles.settingDesc}>Show a confirmation when text is copied</div>
              </div>
              <Switch checked={showConfirm} onChange={setShowConfirm} />
            </div>
          </CardBody>
        </Card>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Privacy</h2>
        <p style={styles.sectionDesc}>Control data collection and sharing.</p>
        <Card>
          <CardBody>
            <div style={styles.settingRow}>
              <div>
                <div style={styles.settingLabel}>Privacy mode</div>
                <div style={styles.settingDesc}>Disable all telemetry and analytics</div>
              </div>
              <Switch checked={privacyMode} onChange={setPrivacyMode} />
            </div>
            <div style={styles.settingRow}>
              <div>
                <div style={styles.settingLabel}>Context menu</div>
                <div style={styles.settingDesc}>Show QuickCopy in right-click menu</div>
              </div>
              <Switch checked={contextMenu} onChange={setContextMenu} />
            </div>
            <div style={{ ...styles.settingRow, borderBottom: 'none' }}>
              <div>
                <div style={styles.settingLabel}>Usage telemetry</div>
                <div style={styles.settingDesc}>Help improve QuickCopy with anonymous usage data</div>
              </div>
              <Switch checked={false} onChange={() => {}} />
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
              <span style={{ color: colors.text.muted }}>OCR (Phase 2)</span>
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
                href="#"
                style={{ color: colors.accent.primary, fontSize: fontSizes.sm }}
              >
                github.com/quickcopy/quickcopy
              </a>
            </div>
          </CardBody>
        </Card>
      </div>

      <div style={styles.footer}>
        <p>{EXTENSION_NAME} v{EXTENSION_VERSION} &mdash; MIT License</p>
      </div>
    </div>
  );
}
