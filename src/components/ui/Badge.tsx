import type { ReactNode } from 'react';
import { colors, spacing, radius, fonts, fontSizes, fontWeights } from '@styles/designSystem';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
}

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  default: {
    background: colors.bg.tertiary,
    color: colors.text.secondary,
  },
  success: {
    background: colors.accentSoft.success,
    color: colors.accent.success,
  },
  warning: {
    background: colors.accentSoft.warning,
    color: colors.accent.warning,
  },
  error: {
    background: colors.accentSoft.error,
    color: colors.accent.error,
  },
  info: {
    background: colors.accentSoft.info,
    color: colors.accent.info,
  },
};

export function Badge({ variant = 'default', children }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: spacing[1],
        padding: `${spacing[0.5]} ${spacing[1.5]}`,
        borderRadius: radius.full,
        fontSize: fontSizes.xs,
        fontWeight: fontWeights.medium,
        fontFamily: fonts.sans,
        lineHeight: 1,
        boxShadow: `inset 0 1px 0 ${colors.glass.highlight}`,
        ...variantStyles[variant],
      }}
    >
      {children}
    </span>
  );
}
