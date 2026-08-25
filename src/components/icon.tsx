/**
 * Material Symbols Outlined — ligature-font icons, matching the
 * Stitch design system 1:1 (every screen references icons by these
 * same string names). Self-hosted variable font; see
 * design-system/fonts.ts and the @font-face in tokens/index.css.
 */
export function Icon({
  name,
  filled = false,
  directional = false,
  size,
  className,
}: {
  name: string;
  filled?: boolean;
  directional?: boolean;
  size?: number;
  className?: string;
}) {
  const classes = [
    'material-symbols-outlined',
    filled ? 'gts-icon-filled' : '',
    directional ? 'gts-icon-directional' : 'gts-icon-fixed',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} style={size ? { fontSize: size } : undefined} aria-hidden="true">
      {name}
    </span>
  );
}
