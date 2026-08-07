import { useId, useState } from 'react';
import { colors, gradients, spacing, radius, fonts, fontSizes, fontWeights, animation } from '@styles/designSystem';

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label?: string;
  disabled?: boolean;
}

export function Select({ value, onChange, options, label, disabled = false }: SelectProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontFamily: fonts.sans,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.medium,
            color: colors.text.secondary,
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            width: '100%',
            padding: `${spacing[1.5]} ${spacing[8]} ${spacing[1.5]} ${spacing[3]}`,
            fontFamily: fonts.sans,
            fontSize: fontSizes.base,
            color: colors.text.primary,
            background: gradients.secondary,
            border: `1px solid ${hovered && !focused ? colors.border.hover : colors.border.default}`,
            borderRadius: radius.lg,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            transition: `border-color ${animation.duration.fast} ${animation.easing.ease}, box-shadow ${animation.duration.fast} ${animation.easing.ease}, background ${animation.duration.fast} ${animation.easing.ease}`,
            outline: 'none',
            appearance: 'none',
            boxShadow: focused
              ? `0 0 0 3px ${colors.focusRing}, inset 0 1px 0 ${colors.glass.highlight}`
              : `inset 0 1px 0 ${colors.glass.highlight}`,
          }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span
          style={{
            position: 'absolute',
            right: spacing[3],
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            color: colors.text.muted,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </div>
  );
}
