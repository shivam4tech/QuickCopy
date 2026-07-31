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
    background: `${colors.accent.success}18`,
    color: colors.accent.success,
  },
  warning: {
    background: `${colors.accent.warning}18`,
    color: colors.accent.warning,
  },
  error: {
    background: `${colors.accent.error}18`,
    color: colors.accent.error,
  },
  info: {
    background: `${colors.accent.info}18`,
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
        ...variantStyles[variant],
      }}
    >
      {children}
    </span>
  );
}
