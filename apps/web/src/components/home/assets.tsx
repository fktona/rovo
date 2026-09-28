export const asset = (name: string) => `/figma-home/${name}`;

export const icons = {
  logo: asset("rovo-logo.svg"),
  logoLight: asset("rovo-logo-light.svg"),
  logoMark: asset("rovo-mark.svg"),
  home: asset("home.svg"),
  launch: asset("launch.svg"),
  rewards: asset("rewards.svg"),
  profile: asset("profile.svg"),
  wallet: asset("wallet.svg"),
  more: asset("more.svg"),
  search: asset("search.svg"),
  caret: asset("caret.svg"),
  trending: asset("trending.svg"),
  new: asset("new.svg"),
  hot: asset("hot.svg"),
  graduated: asset("graduated.svg"),
  vault: asset("vault.svg"),
  creators: asset("creators.svg"),
  x: asset("x.svg"),
} as const;

export function AssetIcon({
  src,
  alt = "",
  width,
  height,
  className,
}: {
  src: string;
  alt?: string;
  width: number;
  height: number;
  className?: string;
}) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className ?? "block"}
    />
  );
}

export function RovoWordmark({
  alt = "Rovo",
  className = "h-[34px] w-auto",
}: {
  alt?: string;
  className?: string;
}) {
  return (
    <span className="inline-flex items-center">
      <AssetIcon
        src={icons.logo}
        alt=""
        width={112}
        height={34}
        className={`rovo-wordmark-dark block ${className}`}
      />
      <AssetIcon
        src={icons.logoLight}
        alt=""
        width={112}
        height={34}
        className={`rovo-wordmark-light hidden ${className}`}
      />
    </span>
  );
}
