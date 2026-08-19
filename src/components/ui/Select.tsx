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
  searchable?: boolean;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Select({ value, onChange, options, label, disabled = false, searchable = false }: SelectProps) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const reduced = prefersReducedMotion();

  const q = query.trim().toLowerCase();
  const visibleOptions = searchable && q
    ? options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
    : options;

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(Math.max(0, visibleOptions.findIndex((o) => o.value === value)));
  }, [open, value, options, searchable]);

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
      setActiveIndex((i) => (i + 1) % Math.max(1, visibleOptions.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + Math.max(1, visibleOptions.length)) % Math.max(1, visibleOptions.length));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const opt = visibleOptions[activeIndex];
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
      style={{ display: 'flex', flexDirection: 'column', gap: spacing[1], position: 'relative', minWidth: 'max-content' }}
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
          minWidth: 'max-content',
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
            ? `0 0 0 3px ${colors.focusRing}`
            : undefined,
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
            maxHeight: 320,
            overflowY: 'auto',
            opacity: reduced ? 1 : entered ? 1 : 0,
            transform: reduced ? 'none' : entered ? 'translateY(0)' : 'translateY(-6px)',
            transition: reduced ? 'none' : `opacity ${animation.duration.fast} ${animation.easing.easeOut}, transform ${animation.duration.fast} ${animation.easing.easeOut}`,
            transformOrigin: 'top center',
          }}
        >
          {searchable && (
            <div style={{ padding: `0 ${spacing[1]} ${spacing[1.5]}`, borderBottom: `1px solid ${colors.border.default}`, marginBottom: spacing[1] }}>
              <input
                type="text"
                autoFocus
                value={query}
                placeholder="Search languages…"
                aria-label="Search languages"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Escape') return;
                  e.stopPropagation();
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: `${spacing[1.5]} ${spacing[2.5]}`,
                  fontFamily: fonts.sans,
                  fontSize: fontSizes.sm,
                  color: colors.text.primary,
                  background: colors.bg.primary,
                  border: `1px solid ${colors.border.default}`,
                  borderRadius: radius.md,
                  outline: 'none',
                }}
              />
            </div>
          )}
          {visibleOptions.map((opt, i) => {
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
          {visibleOptions.length === 0 && (
            <div
              style={{
                padding: `${spacing[2]} ${spacing[3]}`,
                textAlign: 'center',
                color: colors.text.muted,
                fontSize: fontSizes.sm,
              }}
            >
              No languages found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
