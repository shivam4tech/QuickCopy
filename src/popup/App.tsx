import { EXTENSION_NAME, EXTENSION_VERSION } from '@shared/constants';
import { colors, gradients, spacing, radius, fonts, fontSizes, fontWeights, animation } from '@styles/designSystem';
import { Switch } from '@components/ui/Switch';
import { useSettings } from '@hooks/useSettings';

const styles = {
  container: {
    width: 320,
    padding: spacing[2.5],
    fontFamily: fonts.sans,
    color: colors.text.primary,
    background: colors.bg.primary,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2.5],
  } as const,
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    minWidth: 0,
  } as const,
  icon: {
    display: 'block',
    borderRadius: radius.sm,
    flexShrink: 0,
  } as const,
  title: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    letterSpacing: '-0.01em',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as const,
  version: {
    fontSize: fontSizes.xs,
    color: colors.text.muted,
    fontFamily: fonts.mono,
    flexShrink: 0,
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
  card: {
    background: colors.bg.secondary,
    border: `1px solid ${colors.border.default}`,
    borderRadius: radius['2xl'],
    padding: `${spacing[2.5]} ${spacing[3]}`,
  } as const,
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    fontSize: fontSizes.base,
  } as const,
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: colors.accent.success,
    flexShrink: 0,
  } as const,
  guideText: {
    fontSize: fontSizes.base,
    color: colors.text.secondary,
    lineHeight: '1.6',
  } as const,
  guideSep: {
    color: colors.text.muted,
    margin: '0 2px',
  } as const,
  kbd: {
    display: 'inline-block',
    padding: '1px 6px',
    margin: '0 1px',
    borderRadius: radius.sm,
    background: colors.accent.primary,
    border: `1px solid ${colors.accent.primary}`,
    color: colors.text.onAccent,
    fontWeight: fontWeights.semibold,
    fontSize: fontSizes.xs,
    fontFamily: fonts.mono,
    lineHeight: '1.5',
    boxShadow: `0 1px 2px color-mix(in srgb, var(--color-shadow) 45%, transparent)`,
  } as const,
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
    margin: `0 -${spacing[2]}`,
    padding: `0 ${spacing[2]}`,
    borderRadius: radius.md,
    cursor: 'pointer' as const,
    fontSize: fontSizes.base,
    transition: `background ${animation.duration.fast} ${animation.easing.ease}`,
  } as const,
  link: {
    color: colors.text.muted,
    textDecoration: 'none',
    fontSize: fontSizes.sm,
    cursor: 'pointer' as const,
    border: 'none',
    background: 'none',
    padding: 0,
    fontFamily: 'inherit',
    transition: `color ${animation.duration.fast} ${animation.easing.ease}`,
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
    gap: spacing[3],
  } as const,
  toggleLabel: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    letterSpacing: '-0.01em',
  } as const,
  toggleDesc: {
    fontSize: fontSizes.sm,
    color: colors.text.muted,
    marginTop: spacing[1],
  } as const,
  footer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[3],
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
    chrome.tabs.create({ url: 'https://github.com/shivam4tech/Pluk' });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.brand}>
          <img
            src={chrome.runtime.getURL('icons/icon32.png')}
            width="22"
            height="22"
            alt=""
            style={styles.icon}
          />
          <span style={styles.title}>{EXTENSION_NAME}</span>
        </div>
        <span style={styles.version}>v{EXTENSION_VERSION}</span>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Status</div>
        <div style={{ ...styles.card, paddingTop: spacing[2], paddingBottom: spacing[2] }}>
          <div style={styles.statusRow}>
            <span style={{ ...styles.statusDot, background: settings.enabled ? colors.accent.success : colors.accent.error }} />
            <span style={{ fontWeight: fontWeights.medium, letterSpacing: '-0.01em' }}>
              {settings.enabled ? 'Ready' : 'Paused'}
            </span>
            <span style={{ flex: 1 }} />
            <div
              role="radiogroup"
              aria-label="Extension power"
              style={{
                display: 'flex',
                background: colors.bg.tertiary,
                border: `1px solid ${colors.border.default}`,
                borderRadius: radius.full,
                padding: 2,
                gap: 2,
              }}
            >
              {[true, false].map((on) => {
                const active = settings.enabled === on;
                return (
                  <button
                    key={on ? 'on' : 'off'}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => updateSetting('enabled', on)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: spacing[1],
                      flex: 1,
                      padding: `3px ${spacing[3]}`,
                      borderRadius: radius.full,
                      border: 'none',
                      background: active ? gradients.primary : 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
                      boxShadow: active ? '0 1px 2px rgba(0, 0, 0, 0.2)' : 'none',
                      color: active ? colors.text.onAccent : colors.text.secondary,
                      fontSize: fontSizes.xs,
                      fontWeight: fontWeights.semibold,
                      cursor: 'pointer',
                      transition: `background ${animation.duration.normal} ${animation.easing.ease}, color ${animation.duration.fast} ${animation.easing.ease}, box-shadow ${animation.duration.normal} ${animation.easing.ease}`,
                    }}
                  >
                    {on ? 'On' : 'Off'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.section}>
        <div style={styles.sectionTitle}>How to use</div>
        <div style={styles.card}>
          <div style={styles.guideText}>
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
      </div>

      <div style={styles.divider} />

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Panel</div>
        <div style={styles.card}>
          <div style={styles.toggleRow}>
            <div style={{ minWidth: 0 }}>
              <div style={styles.toggleLabel}>Show panel after capture</div>
              <div style={styles.toggleDesc}>Off = silent drag-to-copy</div>
            </div>
            <Switch
              checked={settings.showPanel}
              onChange={(checked) => updateSetting('showPanel', checked)}
            />
          </div>
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.section}>
        <div
          role="button"
          tabIndex={0}
          style={styles.row}
          onClick={openOptions}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openOptions();
            }
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = colors.bg.hover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <span>Settings</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.text.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.footer}>
        <button
          type="button"
          style={{ ...styles.link, color: colors.text.muted }}
          onMouseEnter={(e) => (e.currentTarget.style.color = colors.accent.primary)}
          onMouseLeave={(e) => (e.currentTarget.style.color = colors.text.muted)}
          onClick={openAbout}
        >
          About
        </button>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd style={styles.kbd}>{children}</kbd>;
}