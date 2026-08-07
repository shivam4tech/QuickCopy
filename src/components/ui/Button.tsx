import { useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { colors, gradients, buttonShadows, spacing, radius, fonts, fontSizes, fontWeights, animation, shadows } from '@styles/designSystem';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const baseStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: gradients.primary,
    color: colors.text.onAccent,
    border: 'none',
  },
  secondary: {
    background: gradients.secondary,
    color: colors.text.primary,
    border: `1px solid ${colors.glass.border}`,
  },
  ghost: {
    background: 'transparent',
    color: colors.text.secondary,
    border: 'none',
  },
  danger: {
    background: gradients.danger,
    color: colors.text.onAccent,
    border: 'none',
  },
};

const hoverStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: gradients.primaryHover,
    boxShadow: buttonShadows.primaryHover,
  },
  secondary: {
    background: gradients.secondaryHover,
    borderColor: colors.border.hover,
    boxShadow: `inset 0 1px 0 ${colors.glass.highlight}, ${shadows.md}`,
  },
  ghost: {
    background: colors.glass.hover,
    color: colors.text.primary,
  },
  danger: {
    filter: 'brightness(1.08)',
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
  onMouseEnter,
  onMouseLeave,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  ...props
}: ButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const base = baseStyles[variant];
  const hov = hoverStyles[variant];

  const boxShadow = pressed
    ? variant === 'ghost'
      ? undefined
      : `inset 0 1px 2px color-mix(in srgb, var(--color-shadow) 60%, transparent)`
    : hovered
      ? hov.boxShadow
      : variant === 'primary'
        ? buttonShadows.primary
        : variant === 'secondary'
          ? `inset 0 1px 0 ${colors.glass.highlight}, ${shadows.sm}`
          : variant === 'danger'
            ? `0 1px 2px rgba(0, 0, 0, 0.35), 0 4px 14px color-mix(in srgb, var(--color-accent-error) 22%, transparent)`
            : undefined;

  const hoverApplied = pressed ? { ...hov, boxShadow: undefined } : hov;

  const merged: React.CSSProperties = {
    ...base,
    boxShadow,
    ...hoverApplied,
    ...(pressed ? { transform: 'translateY(1px)' } : null),
  };

  return (
    <button
      disabled={disabled || loading}
      onMouseEnter={(e) => {
        if (!disabled) setHovered(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setHovered(false);
        setPressed(false);
        onMouseLeave?.(e);
      }}
      onPointerDown={(e) => {
        if (!disabled) setPressed(true);
        onPointerDown?.(e);
      }}
      onPointerUp={(e) => {
        setPressed(false);
        onPointerUp?.(e);
      }}
      onPointerLeave={(e) => {
        setPressed(false);
        onPointerLeave?.(e);
      }}
      onPointerCancel={(e) => {
        setPressed(false);
        onPointerCancel?.(e);
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: fontWeights.medium,
        borderRadius: radius.md,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: `background ${animation.duration.fast} ${animation.easing.ease}, box-shadow ${animation.duration.normal} ${animation.easing.ease}, border-color ${animation.duration.fast} ${animation.easing.ease}, transform ${animation.duration.fast} ${animation.easing.ease}, filter ${animation.duration.fast} ${animation.easing.ease}`,
        width: fullWidth ? '100%' : undefined,
        whiteSpace: 'nowrap',
        fontFamily: fonts.sans,
        ...merged,
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
