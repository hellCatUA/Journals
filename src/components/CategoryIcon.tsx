'use client';

/**
 * Renders a monochrome Lucide icon (served from /icons/<name>.svg) tinted
 * with an arbitrary color via CSS mask, so one icon set works with every
 * category color in both themes. Falls back to a plain dot when the
 * category has no icon assigned.
 */
export default function CategoryIcon({
  icon,
  color,
  size = 20,
  className = '',
}: {
  icon: string | null | undefined;
  color: string;
  size?: number;
  className?: string;
}) {
  if (!icon) {
    return (
      <span
        aria-hidden
        className={`inline-block rounded-full ${className}`}
        style={{ width: size * 0.5, height: size * 0.5, backgroundColor: color }}
      />
    );
  }

  const mask = `url(/icons/${icon}.svg)`;
  return (
    <span
      aria-hidden
      className={`inline-block ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        WebkitMaskImage: mask,
        maskImage: mask,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  );
}
