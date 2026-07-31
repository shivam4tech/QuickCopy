import { useId } from 'react';
import { colors, spacing, radius, fonts, fontSizes, fontWeights, animation } from '@styles/designSystem';

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
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          padding: `${spacing[1.5]} ${spacing[3]}`,
          fontFamily: fonts.sans,
          fontSize: fontSizes.base,
          color: colors.text.primary,
          background: colors.bg.tertiary,
          border: `1px solid ${colors.border.default}`,
          borderRadius: radius.md,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: `border-color ${animation.duration.fast} ${animation.easing.ease}`,
          outline: 'none',
          appearance: 'none',
          paddingRight: spacing[8],
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%238b949e' viewBox='0 0 16 16'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: `right ${spacing[2.5]} center`,
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
