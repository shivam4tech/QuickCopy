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

export function App() {
  const { settings, updateSetting } = useSettings();

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
            <div style={{ ...styles.settingRow, borderBottom: 'none' }}>
              <div>
                <div style={styles.settingLabel}>Language</div>
                <div style={styles.settingDesc}>English is always used (more coming)</div>
              </div>
              <span style={{ color: colors.text.muted, fontSize: fontSizes.sm }}>English</span>
            </div>
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
    </div>
  );
}
