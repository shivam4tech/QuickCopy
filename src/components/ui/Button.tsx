import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { colors, spacing, radius, fonts, fontSizes, fontWeights, animation } from '@styles/designSystem';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: colors.accent.primary,
    color: colors.text.inverse,
    border: 'none',
  },
  secondary: {
    background: colors.bg.tertiary,
    color: colors.text.primary,
    border: `1px solid ${colors.border.default}`,
  },
  ghost: {
    background: 'transparent',
    color: colors.text.secondary,
    border: 'none',
  },
  danger: {
    background: colors.accent.error,
    color: '#ffffff',
    border: 'none',
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    padding: `${spacing[1]} ${spacing[2]}`,
    fontSize: fontSizes.sm,
    gap: spacing[1],
  },
  md: {
    padding: `${spacing[1.5]} ${spacing[3]}`,
    fontSize: fontSizes.base,
    gap: spacing[1.5],
  },
  lg: {
    padding: `${spacing[2]} ${spacing[4]}`,
    fontSize: fontSizes.lg,
    gap: spacing[2],
  },
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  children,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: fontWeights.medium,
        borderRadius: radius.md,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: `all ${animation.duration.fast} ${animation.easing.ease}`,
        width: fullWidth ? '100%' : undefined,
        whiteSpace: 'nowrap',
        fontFamily: fonts.sans,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <span style={{ display: 'inline-block', width: 14, height: 14 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" opacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
        </span>
      ) : icon ? (
        <span style={{ display: 'inline-flex' }}>{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
