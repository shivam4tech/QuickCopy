import { useState, useId } from 'react';
import { colors, spacing, radius, fonts, fontSizes, shadows, zIndex } from '@styles/designSystem';

interface TooltipProps {
  text: string;
}

export function Tooltip({ text }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tipId = useId();

  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <button
        type="button"
        aria-label={text}
        aria-describedby={tipId}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          borderRadius: radius.full,
          color: colors.text.muted,
          background: 'transparent',
          cursor: 'help',
          fontFamily: fonts.sans,
          fontSize: fontSizes.xs,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M6.2 6.4a1.8 1.8 0 1 1 2.6 1.65c-.55.26-.8.55-.8 1.15v.2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="8" cy="11.6" r="0.9" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <span
          id={tipId}
          role="tooltip"
          style={{
            position: 'absolute',
            left: 0,
            top: 'calc(100% + 6px)',
            zIndex: zIndex.tooltip,
            width: 240,
            maxWidth: '60vw',
            padding: `${spacing[1.5]} ${spacing[2.5]}`,
            background: colors.bg.tertiary,
            border: `1px solid ${colors.border.default}`,
            borderRadius: radius.md,
            boxShadow: shadows.md,
            fontFamily: fonts.sans,
            fontSize: fontSizes.sm,
            lineHeight: 1.5,
            color: colors.text.primary,
            textAlign: 'left',
            fontWeight: 400,
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
