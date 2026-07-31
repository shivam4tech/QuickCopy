import { useId } from 'react';
import { colors, spacing, radius, fonts, fontSizes, animation } from '@styles/designSystem';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled = false }: SwitchProps) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: spacing[2],
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: fonts.sans,
        fontSize: fontSizes.base,
        color: colors.text.primary,
      }}
    >
      <span
        role="checkbox"
        aria-checked={checked}
        id={id}
        tabIndex={0}
        onClick={() => !disabled && onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            if (!disabled) onChange(!checked);
          }
        }}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          width: 36,
          height: 20,
          borderRadius: radius.full,
          background: checked ? colors.accent.primary : colors.bg.tertiary,
          border: `1px solid ${checked ? 'transparent' : colors.border.default}`,
          transition: `all ${animation.duration.fast} ${animation.easing.ease}`,
          outline: 'none',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: 'block',
            width: 14,
            height: 14,
            borderRadius: radius.full,
            background: '#ffffff',
            transition: `transform ${animation.duration.fast} ${animation.easing.ease}`,
            transform: checked ? 'translateX(18px)' : 'translateX(2px)',
          }}
        />
      </span>
      {label && <span>{label}</span>}
    </label>
  );
}
