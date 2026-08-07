import { useId, useEffect, useRef, useState } from 'react';
import { colors, gradients, spacing, radius, fonts, fontSizes, animation } from '@styles/designSystem';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

const TRACK_WIDTH = 32;
const TRACK_HEIGHT = 18;
const KNOB_SIZE = 12;
const KNOB_PAD = 2;
const ON_X = TRACK_WIDTH - KNOB_SIZE - KNOB_PAD;
const OFF_X = KNOB_PAD;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Switch({ checked, onChange, label, disabled = false }: SwitchProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const knobRef = useRef<HTMLSpanElement>(null);
  const prevChecked = useRef(checked);

  useEffect(() => {
    const knob = knobRef.current;
    if (!knob) return;
    const from = prevChecked.current ? ON_X : OFF_X;
    const to = checked ? ON_X : OFF_X;
    prevChecked.current = checked;
    if (from === to || prefersReducedMotion()) return;

    knob.getAnimations().forEach((a) => a.cancel());
    const mid = (from + to) / 2;
    knob.animate(
      [
        { transform: `translateX(${from}px) scaleX(1)` },
        { transform: `translateX(${mid}px) scaleX(1.34)`, offset: 0.5 },
        { transform: `translateX(${to}px) scaleX(1)` },
      ],
      {
        duration: 340,
        easing: 'cubic-bezier(0.34, 1.25, 0.64, 1)',
      },
    );
  }, [checked]);

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
          width: TRACK_WIDTH,
          height: TRACK_HEIGHT,
          borderRadius: radius.full,
          background: checked ? gradients.primary : `color-mix(in srgb, var(--color-text-primary) 7%, transparent)`,
          border: `1px solid ${checked ? 'transparent' : colors.border.default}`,
          transition: `background ${animation.duration.normal} ${animation.easing.ease}, border-color ${animation.duration.normal} ${animation.easing.ease}, box-shadow ${animation.duration.normal} ${animation.easing.ease}`,
          boxShadow: checked
            ? `inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 0 8px color-mix(in srgb, var(--color-accent-primary) 25%, transparent)`
            : `inset 0 1px 0 rgba(255, 255, 255, 0.12)`,
          outline: 'none',
          flexShrink: 0,
        }}
      >
        <span
          ref={knobRef}
          style={{
            display: 'block',
            width: KNOB_SIZE,
            height: KNOB_SIZE,
            borderRadius: radius.full,
            background: 'linear-gradient(180deg, #ffffff 0%, #f2f4f7 100%)',
            boxShadow: `0 1px 2px rgba(0, 0, 0, 0.35), 0 0 0 0.5px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)`,
            willChange: 'transform',
            transform: `translateX(${checked ? ON_X : OFF_X}px) scaleX(1)`,
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
