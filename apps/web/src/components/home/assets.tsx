export const asset = (name: string) => `/figma-home/${name}`;

export const icons = {
  logo: asset("rovo-logo.svg"),
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
}: {
  src: string;
  alt?: string;
  width: number;
  height: number;
}) {
  // Figma SVGs are served as separate files at their intrinsic dimensions.
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      width={src.endsWith(".svg") ? undefined : width}
      height={src.endsWith(".svg") ? undefined : height}
    />
  );
}
