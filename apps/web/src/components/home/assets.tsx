export const asset = (name: string) => `/figma-home/${name}`;

export const icons = {
  logo: "/folio.png",
  logoLight: "/folio.png",
  logoMark: "/folio.png",
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
  className = "h-[34px] w-auto",
}: {
  className?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <AssetIcon
        src={icons.logo}
        alt=""
        width={34}
        height={34}
        className={`block object-contain ${className}`}
      />
      <span className="text-[15px] font-semibold tracking-tight text-foreground">
        TryFolio
      </span>
    </span>
  );
}
