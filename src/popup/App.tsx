import { EXTENSION_NAME, EXTENSION_VERSION } from '@shared/constants';
import { colors, spacing, radius, fonts, fontSizes, fontWeights, animation } from '@styles/designSystem';
import { Switch } from '@components/ui/Switch';
import { useSettings } from '@hooks/useSettings';

const styles = {
  container: {
    width: 280,
    padding: spacing[4],
    fontFamily: fonts.sans,
    color: colors.text.primary,
    background: colors.bg.primary,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  } as const,
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
  } as const,
  title: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
  } as const,
  version: {
    fontSize: fontSizes.xs,
    color: colors.text.muted,
  } as const,
  section: {
    marginBottom: spacing[3],
  } as const,
  sectionTitle: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.text.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: spacing[2],
  } as const,
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    padding: `${spacing[2]} ${spacing[3]}`,
    background: colors.bg.secondary,
    borderRadius: radius.md,
    fontSize: fontSizes.sm,
  } as const,
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: colors.accent.success,
    flexShrink: 0,
  } as const,
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${spacing[1.5]} ${spacing[3]}`,
    borderRadius: radius.md,
    cursor: 'pointer',
    fontSize: fontSizes.sm,
    transition: `background ${animation.duration.fast} ${animation.easing.ease}`,
  } as const,
  link: {
    color: colors.accent.primary,
    textDecoration: 'none',
    fontSize: fontSizes.sm,
    cursor: 'pointer',
  } as const,
  divider: {
    height: 1,
    background: colors.border.muted,
    margin: `${spacing[3]} 0`,
  } as const,
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${spacing[1.5]} ${spacing[3]}`,
    borderRadius: radius.md,
    background: colors.bg.secondary,
  } as const,
  toggleLabel: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
  } as const,
  toggleDesc: {
    fontSize: fontSizes.xs,
    color: colors.text.muted,
    marginTop: spacing[0.5],
  } as const,
};

export function App() {
  const openOptions = () => chrome.runtime.openOptionsPage();
  const { settings, updateSetting } = useSettings();

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.brand}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.accent.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="8" y="2" width="8" height="4" rx="1" />
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <path d="M12 11v6" />
            <path d="M9 14l3 3 3-3" />
          </svg>
          <span style={styles.title}>{EXTENSION_NAME}</span>
        </div>
        <span style={styles.version}>v{EXTENSION_VERSION}</span>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Status</div>
        <div style={styles.statusRow}>
          <span style={styles.statusDot} />
          <span>Ready</span>
          <span style={{ marginLeft: 'auto', color: colors.text.muted, fontSize: fontSizes.xs }}>
            OCR not configured
          </span>
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Panel</div>
        <div style={styles.toggleRow}>
          <div>
            <div style={styles.toggleLabel}>Show panel after capture</div>
            <div style={styles.toggleDesc}>Off = silent drag-to-copy</div>
          </div>
          <Switch
            checked={settings.showPanel}
            onChange={(checked) => updateSetting('showPanel', checked)}
          />
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Shortcuts</div>
        <div style={styles.row}>
          <span>Capture Region</span>
          <span style={{ color: colors.text.muted, fontSize: fontSizes.xs }}>Alt+Shift+C</span>
        </div>
        <div style={styles.row}>
          <span>Toggle Sidebar</span>
          <span style={{ color: colors.text.muted, fontSize: fontSizes.xs }}>Alt+Shift+S</span>
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.section}>
        <div style={styles.row} onClick={openOptions}>
          <span>Settings</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.text.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>

      <div style={styles.divider} />

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: spacing[3],
          fontSize: fontSizes.xs,
          color: colors.text.muted,
        }}
      >
        <a style={styles.link} href="https://quickcopy.app" target="_blank" rel="noreferrer">About</a>
        <span>Privacy</span>
        <span>v{EXTENSION_VERSION}</span>
      </div>
    </div>
  );
}
