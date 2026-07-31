import type { ReactNode, CSSProperties } from 'react';
import { colors, spacing, radius, shadows } from '@styles/designSystem';

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  hover?: boolean;
}

export function Card({ children, style, hover = false }: CardProps) {
  return (
    <div
      style={{
        background: colors.bg.secondary,
        border: `1px solid ${colors.border.default}`,
        borderRadius: radius.lg,
        padding: spacing[4],
        boxShadow: shadows.sm,
        transition: hover ? 'border-color 150ms ease, box-shadow 150ms ease' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing[3],
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardBody({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={style}>{children}</div>;
}

export function CardFooter({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: spacing[2],
        marginTop: spacing[4],
        paddingTop: spacing[3],
        borderTop: `1px solid ${colors.border.muted}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
