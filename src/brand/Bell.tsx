/*
 * The mark: a butler's call bell — the small domed bell on a hall desk.
 * It means summon and notify, reads at 16px, and quietly rhymes with
 * "bellwether." It is never animated as a ringing bell. Bramwell does not jingle.
 */
export function Bell({
  size = 24,
  tone = "brass",
  title = "Bramwell",
}: {
  size?: number;
  tone?: "brass" | "ink";
  title?: string;
}) {
  const fill = tone === "brass" ? "var(--brass)" : "var(--ink)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      fill="none"
    >
      <title>{title}</title>
      {/* stem + knob */}
      <line x1="12" y1="4.5" x2="12" y2="7" stroke={fill} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="4" r="1.4" fill={fill} />
      {/* dome */}
      <path d="M4.5 17.5 C4.5 10.5 19.5 10.5 19.5 17.5 Z" fill={fill} />
      {/* hall-desk plate */}
      <rect x="3" y="18.4" width="18" height="2" rx="1" fill={fill} />
    </svg>
  );
}
