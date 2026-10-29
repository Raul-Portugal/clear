/** A tiny three-bar meter (like signal strength) used for effort. Inherits `color`. */
export function Bars({ level, size = 12 }: { level: 1 | 2 | 3; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={1 + i * 4}
          y={8 - i * 3}
          width={2.4}
          height={3 + i * 3}
          rx={1}
          fill="currentColor"
          opacity={i < level ? 1 : 0.25}
        />
      ))}
    </svg>
  );
}
