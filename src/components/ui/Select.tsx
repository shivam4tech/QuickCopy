import { useId, useEffect, useRef, useState } from 'react';
import { colors, gradients, spacing, radius, fonts, fontSizes, fontWeights, animation, shadows, zIndex } from '@styles/designSystem';

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

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Select({ value, onChange, options, label, disabled = false }: SelectProps) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (open) setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [open, value, options]);

  useEffect(() => {
    if (!open) return;
    setEntered(false);
    const raf = requestAnimationFrame(() => setEntered(true));
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setEntered(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const opt = options[activeIndex];
      if (opt) onChange(opt.value);
      close();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      close();
    }
  };

  return (
    <div
      ref={rootRef}
      onKeyDown={handleKeyDown}
      style={{ display: 'flex', flexDirection: 'column', gap: spacing[1], position: 'relative', minWidth: 176 }}
    >
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
      <button
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-opt-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: spacing[2],
          padding: `${spacing[1.5]} ${spacing[3]}`,
          fontFamily: fonts.sans,
          fontSize: fontSizes.base,
          color: colors.text.primary,
          background: gradients.secondary,
          border: `1px solid ${hovered && !focused ? colors.border.hover : colors.border.default}`,
          borderRadius: radius.lg,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          textAlign: 'left',
          transition: `border-color ${animation.duration.fast} ${animation.easing.ease}, box-shadow ${animation.duration.fast} ${animation.easing.ease}, background ${animation.duration.fast} ${animation.easing.ease}`,
          boxShadow: focused
            ? `0 0 0 3px ${colors.focusRing}, inset 0 1px 0 ${colors.glass.highlight}`
            : `inset 0 1px 0 ${colors.glass.highlight}`,
        }}
      >
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: selected ? colors.text.primary : colors.text.muted,
          }}
        >
          {selected ? selected.label : value}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          style={{
            flexShrink: 0,
            color: colors.text.muted,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: `transform ${animation.duration.fast} ${animation.easing.ease}`,
          }}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={label ?? 'Options'}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            minWidth: 'max-content',
            maxWidth: 'calc(100vw - 48px)',
            zIndex: zIndex.dropdown,
            background: colors.bg.secondary,
            border: `1px solid ${colors.border.default}`,
            borderRadius: radius.lg,
            boxShadow: shadows.lg,
            padding: spacing[1],
            opacity: reduced ? 1 : entered ? 1 : 0,
            transform: reduced ? 'none' : entered ? 'translateY(0)' : 'translateY(-6px)',
            transition: reduced ? 'none' : `opacity ${animation.duration.fast} ${animation.easing.easeOut}, transform ${animation.duration.fast} ${animation.easing.easeOut}`,
            transformOrigin: 'top center',
          }}
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isActive = i === activeIndex;
            return (
              <div
                key={opt.value}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  close();
                }}
                onMouseEnter={() => setActiveIndex(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing[2],
                  padding: `${spacing[1.5]} ${spacing[2]}`,
                  borderRadius: radius.md,
                  fontSize: fontSizes.base,
                  color: isSelected ? colors.text.primary : colors.text.secondary,
                  background: isActive ? colors.bg.hover : 'transparent',
                  cursor: 'pointer',
                  transition: `background ${animation.duration.fast} ${animation.easing.ease}, color ${animation.duration.fast} ${animation.easing.ease}`,
                }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {opt.label}
                </span>
                {isSelected && (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: colors.accent.primary }}>
                    <path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
