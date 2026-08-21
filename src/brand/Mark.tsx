/*
 * The mark: an arch — the vault, the portico, the threshold. Banking's oldest
 * symbol of stability and custody, with the old call bell's dome still living
 * in its curve (Bramwell began as a butler's bell; "bellwether" endures in the
 * name). Institutional and geometric, it reads cleanly down to 16px. It is
 * never animated. Bramwell keeps the watch; he does not fuss.
 */
export function Mark({
  size = 24,
  tone = "ink",
  title = "Bramwell",
}: {
  size?: number;
  tone?: "brass" | "ink";
  title?: string;
}) {
  // Default is ink, so the mark matches the wordmark in the lockup; the accent
  // tone stays available for monochrome-on-colour uses.
  const fill = tone === "brass" ? "var(--brass)" : "var(--ink)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      fill="none"
    >
      <title>{title}</title>
      {/* the arch — two legs, a rounded span, hollow centre */}
      <path
        d="M7 25 L7 16 A9 9 0 0 1 25 16 L25 25 L20.5 25 L20.5 16 A4.5 4.5 0 0 0 11.5 16 L11.5 25 Z"
        fill={fill}
      />
      {/* the plinth it stands on */}
      <rect x="4" y="25.4" width="24" height="2.7" rx="1.35" fill={fill} />
    </svg>
  );
}
