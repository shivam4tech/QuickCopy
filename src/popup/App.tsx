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
    marginBottom: spacing[3],
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
    marginBottom: spacing[2.5],
  } as const,
  sectionTitle: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.text.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: spacing[1.5],
  } as const,
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    padding: `${spacing[1.5]} ${spacing[2.5]}`,
    background: colors.glass.bg,
    backgroundImage: colors.glass.sheen,
    border: `1px solid ${colors.glass.border}`,
    borderRadius: radius.lg,
    boxShadow: `inset 0 1px 0 ${colors.glass.highlight}`,
    fontSize: fontSizes.sm,
  } as const,
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: colors.accent.success,
    flexShrink: 0,
  } as const,
  guideCard: {
    padding: spacing[2.5],
    background: colors.glass.bg,
    backgroundImage: colors.glass.sheen,
    border: `1px solid ${colors.glass.border}`,
    borderRadius: radius.lg,
    boxShadow: `inset 0 1px 0 ${colors.glass.highlight}`,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    lineHeight: '1.7',
  } as const,
  guideSep: {
    color: colors.text.muted,
    margin: '0 2px',
  } as const,
  kbd: {
    display: 'inline-block',
    padding: '1px 5px',
    margin: '0 1px',
    borderRadius: radius.sm,
    background: colors.bg.tertiary,
    border: `1px solid ${colors.border.active}`,
    color: colors.accent.primary,
    fontWeight: fontWeights.semibold,
    fontSize: fontSizes.xs,
    fontFamily: fonts.mono,
    lineHeight: '1.5',
    boxShadow: '0 1px 0 rgba(0,0,0,0.15)',
  } as const,
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${spacing[1.5]} ${spacing[2.5]}`,
    borderRadius: radius.md,
    cursor: 'pointer',
    fontSize: fontSizes.sm,
  } as const,
  link: {
    color: colors.accent.primary,
    textDecoration: 'none',
    fontSize: fontSizes.sm,
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    padding: 0,
    fontFamily: 'inherit',
  } as const,
  divider: {
    height: 1,
    background: colors.border.muted,
    margin: `${spacing[2.5]} 0`,
  } as const,
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${spacing[1.5]} ${spacing[2.5]}`,
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
  footer: {
    display: 'flex',
    justifyContent: 'center',
    gap: spacing[3],
    fontSize: fontSizes.xs,
    color: colors.text.muted,
  } as const,
};

export function App() {
  const openOptions = () => chrome.runtime.openOptionsPage();
  const { settings, updateSetting } = useSettings();

  const isMac = /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
  const dragKeys = settings.dragModifier === 'alt+shift'
    ? [isMac ? 'Option' : 'Alt', 'Shift']
    : [isMac ? 'Cmd' : 'Ctrl'];
  const pdfShortcut = ['Alt', 'Shift', 'Q'];

  const openAbout = () => {
    chrome.tabs.create({ url: 'https://github.com/shivam4tech/Ekadanta' });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.brand}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.accent.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <span style={{ ...styles.statusDot, background: settings.enabled ? colors.accent.success : colors.text.muted }} />
          <span>{settings.enabled ? 'Ready' : 'Paused'}</span>
          <span style={{ flex: 1 }} />
          <div
            role="radiogroup"
            aria-label="Extension power"
            style={{
              position: 'relative',
              display: 'flex',
              background: colors.bg.tertiary,
              borderRadius: radius.full,
              padding: 2,
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: 2,
                bottom: 2,
                width: 'calc(50% - 2px)',
                borderRadius: radius.full,
                background: colors.bg.secondary,
                boxShadow: `0 1px 3px rgba(0,0,0,0.25), inset 0 1px 0 ${colors.glass.highlight}`,
                transform: settings.enabled ? 'translateX(100%)' : 'translateX(0)',
                transition: `transform ${animation.duration.slow} ${animation.easing.spring}`,
                willChange: 'transform',
              }}
            />
            {[true, false].map((on) => (
              <button
                key={on ? 'on' : 'off'}
                type="button"
                role="radio"
                aria-checked={settings.enabled === on}
                onClick={() => updateSetting('enabled', on)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing[1],
                  flex: 1,
                  padding: `2px ${spacing[2]}`,
                  borderRadius: radius.full,
                  border: 'none',
                  background: 'transparent',
                  color: settings.enabled === on ? colors.text.primary : colors.text.muted,
                  fontSize: fontSizes.xs,
                  fontWeight: fontWeights.medium,
                  cursor: 'pointer',
                  transition: `color ${animation.duration.fast} ${animation.easing.ease}`,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: settings.enabled === on ? colors.accent.success : 'transparent',
                    border: `1px solid ${settings.enabled === on ? colors.accent.success : colors.border.default}`,
                    flexShrink: 0,
                    transition: `background ${animation.duration.fast} ${animation.easing.ease}, border-color ${animation.duration.fast} ${animation.easing.ease}`,
                  }}
                />
                {on ? 'On' : 'Off'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.section}>
        <div style={styles.sectionTitle}>How to use</div>
        <div style={styles.guideCard}>
          Hold{' '}
          {dragKeys.map((key, i) => (
            <span key={key}>
              {i > 0 && <span style={styles.guideSep}>+</span>}
              <Kbd>{key}</Kbd>
            </span>
          ))}
          <span style={styles.guideSep}>+</span>
          <Kbd>Drag</Kbd> with Left Mouse
          <br />
          Release — text is copied automatically
          <br />
          <br />
          On a PDF: press{' '}
          {pdfShortcut.map((key, i) => (
            <span key={key}>
              {i > 0 && <span style={styles.guideSep}>+</span>}
              <Kbd>{key}</Kbd>
            </span>
          ))}
          {' '}to open the capture window
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
        <div style={styles.row} onClick={openOptions}>
          <span>Settings</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.text.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.footer}>
        <button type="button" style={styles.link} onClick={openAbout}>About</button>
        <span>v{EXTENSION_VERSION}</span>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd style={styles.kbd}>{children}</kbd>;
}
