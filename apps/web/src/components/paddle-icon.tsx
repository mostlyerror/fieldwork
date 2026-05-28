export function PaddleIcon({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Paddle head */}
      <ellipse cx="12" cy="9" rx="6.5" ry="7.5" fill="#065f46" />
      <ellipse cx="12" cy="9" rx="6.5" ry="7.5" stroke="#0a0a0a" strokeWidth="1.2" />
      {/* Texture dots */}
      <circle cx="10" cy="7" r="0.5" fill="#FFFDF7" opacity="0.4" />
      <circle cx="13" cy="6" r="0.5" fill="#FFFDF7" opacity="0.4" />
      <circle cx="14" cy="10" r="0.5" fill="#FFFDF7" opacity="0.4" />
      <circle cx="9" cy="11" r="0.5" fill="#FFFDF7" opacity="0.4" />
      {/* Handle */}
      <rect x="11" y="15.5" width="2" height="5.5" rx="0.8" fill="#0a0a0a" />
      <rect x="11" y="15.5" width="2" height="1.2" fill="#d4af37" opacity="0.7" />
    </svg>
  );
}

export function BallIcon({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="7" fill="#d4af37" stroke="#0a0a0a" strokeWidth="1" />
      {/* Pickleball holes */}
      <circle cx="6" cy="6" r="0.7" fill="#0a0a0a" />
      <circle cx="10" cy="6" r="0.7" fill="#0a0a0a" />
      <circle cx="8" cy="9" r="0.7" fill="#0a0a0a" />
      <circle cx="5" cy="9.5" r="0.6" fill="#0a0a0a" />
      <circle cx="11" cy="9.5" r="0.6" fill="#0a0a0a" />
    </svg>
  );
}
