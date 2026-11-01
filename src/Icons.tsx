import type { CSSProperties } from "react";
export type IconName =
  | "play"
  | "pause"
  | "sound"
  | "mute"
  | "wallet"
  | "arrow"
  | "external"
  | "trophy"
  | "close"
  | "bolt"
  | "info"
  | "controls"
  | "refresh"
  | "download"
  | "check"
  | "moon"
  | "coin"
  | "nut"
  | "wheel"
  | "chevron"
  | "shield";
const paths: Record<IconName, React.ReactNode> = {
  play: <path d="m9 5 11 7-11 7z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <path d="M8 5v14M16 5v14" strokeWidth="3" />
    </>
  ),
  sound: (
    <>
      <path d="m11 5-6 5H2v4h3l6 5zM15 8a6 6 0 0 1 0 8M18 4a11 11 0 0 1 0 16" />
    </>
  ),
  mute: (
    <>
      <path d="m11 5-6 5H2v4h3l6 5zM17 9l6 6m0-6-6 6" />
    </>
  ),
  wallet: (
    <>
      <path d="M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0-3 3v13a2 2 0 0 0 2 2h16V8H5a2 2 0 0 1 0-4" />
      <path d="M20 12h-5v5h5M17 14.5h.01" />
    </>
  ),
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  external: (
    <>
      <path d="M14 3h7v7M21 3l-11 11M10 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 3h8v7a4 4 0 0 1-8 0zM8 5H3v3a5 5 0 0 0 5 5m8-8h5v3a5 5 0 0 1-5 5M12 14v6m-4 1h8" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  bolt: <path d="m13 2-9 12h7l-1 8 10-13h-8z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10h.01" />
    </>
  ),
  controls: (
    <>
      <rect x="2" y="6" width="20" height="13" rx="3" />
      <path d="M7 10v5m-2-2.5h4m7-1.5h.01m3 3h.01" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M5 7a8 8 0 0 1 14-1l1 6M4 12l1 6a8 8 0 0 0 14-1" />
    </>
  ),
  download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
  check: <path d="m4 12 5 5L20 6" />,
  moon: <path d="M20 14A9 9 0 0 1 10 4a9 9 0 1 0 10 10Z" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v12" />
    </>
  ),
  nut: (
    <>
      <path d="M5 10h14l-2 8-5 4-5-4zM5 10V7h14v3M12 7V3l3-1" />
    </>
  ),
  wheel: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2" />
      <path d="m6 6 4 4m4 4 4 4M6 18l4-4m4-4 4-4M3 12h7m4 0h7M12 3v7m0 4v7" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  shield: <path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6zM8 12l3 3 5-6" />,
};
export function Icon({
  name,
  size = 20,
  className = "",
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {paths[name]}
    </svg>
  );
}
export function HamsterMark({ size = 36 }: { size?: number }) {
  return <img src="./favicon.svg" width={size} height={size} alt="" />;
}
