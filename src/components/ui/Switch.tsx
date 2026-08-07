import { useId, useState } from 'react';
import { colors, gradients, spacing, radius, fonts, fontSizes, animation } from '@styles/designSystem';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled = false }: SwitchProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);

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
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          width: 36,
          height: 20,
          borderRadius: radius.full,
          background: checked ? gradients.primary : gradients.secondary,
          border: `1px solid ${checked ? 'transparent' : colors.border.default}`,
          transition: `background ${animation.duration.normal} ${animation.easing.ease}, border-color ${animation.duration.normal} ${animation.easing.ease}, box-shadow ${animation.duration.normal} ${animation.easing.ease}`,
          boxShadow: checked
            ? `0 0 0 1px color-mix(in srgb, var(--color-accent-primary) 30%, transparent), 0 0 12px color-mix(in srgb, var(--color-accent-primary) 40%, transparent)`
            : `inset 0 1px 0 ${colors.glass.highlight}`,
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
            background: 'linear-gradient(180deg, #ffffff 0%, #e9edf2 100%)',
            boxShadow: `0 1px 3px rgba(0, 0, 0, 0.4), 0 0 0 0.5px rgba(0, 0, 0, 0.12)`,
            transition: `transform ${animation.duration.slower} ${animation.easing.spring}`,
            transform: checked ? 'translateX(18px)' : 'translateX(2px)',
          }}
        />
        {focused && (
          <span
            style={{
              position: 'absolute',
              inset: -3,
              borderRadius: radius.full,
              border: `2px solid ${colors.focusRing}`,
              pointerEvents: 'none',
            }}
          />
        )}
      </span>
      {label && <span>{label}</span>}
    </label>
  );
}
