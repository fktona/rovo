const columns =
  "md:grid-cols-[minmax(10rem,1.5fr)_minmax(5.5rem,0.75fr)_minmax(5.5rem,0.75fr)_minmax(7.5rem,0.85fr)_minmax(6rem,0.9fr)]";

export const styles = {
  srOnly: "sr-only",
  dashboard: "flex min-h-full flex-col bg-canvas text-base",
  navLinkActive: "bg-accent-soft text-accent hover:bg-accent-soft",
  header:
    "solana-shell-header relative grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 px-4 py-3 md:flex md:flex-nowrap md:gap-3 lg:gap-4 lg:px-8 lg:py-5",
  searchBox:
    "col-span-2 flex h-11 w-full min-w-0 items-center gap-2 rounded-xl bg-surface px-3.5 md:order-1 md:col-auto md:h-10 md:w-auto md:flex-1 lg:mx-auto lg:max-w-md [&_img]:shrink-0",
  searchInput:
    "w-full min-w-0 border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:cursor-pointer",
  loginButton:
    "shrink-0 whitespace-nowrap rounded-[10px] bg-action px-3 py-1 text-xs font-medium text-ink hover:bg-action-hover md:px-4 md:py-2 md:text-sm",
  main: "min-h-full flex-1 flex-col px-4 sm:px-6 lg:px-8",
  assetBar:
    "flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-6 lg:py-5",
  allSelector: "inline-flex shrink-0 items-center gap-1",
  assetSelect:
    "w-auto cursor-pointer appearance-none border-0 bg-transparent p-0 text-base text-foreground outline-none [&_option]:bg-surface",
  pairFilters:
    "flex min-w-0 items-center gap-3 overflow-x-auto [scrollbar-width:none] sm:gap-5 lg:gap-6 [&::-webkit-scrollbar]:hidden",
  pairFilter:
    "flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border-0 px-2 py-1.5 text-sm text-foreground hover:bg-surface sm:text-base [&_img]:block [&_img]:shrink-0 [&_img]:object-contain",
  pairFilterActive: "bg-surface px-2",
  tablePanel:
    "flex flex-1 flex-col overflow-hidden rounded-t-[20px] border border-line border-b-0 p-4 pb-8 sm:p-5 sm:pb-9",
  viewTabs:
    "flex items-center gap-3 overflow-x-auto [scrollbar-width:none] sm:gap-6 [&::-webkit-scrollbar]:hidden",
  viewTab:
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-medium text-foreground hover:text-accent sm:text-base [&_img]:block [&_img]:shrink-0",
  viewTabActive: "border border-accent-border bg-accent-soft px-3 text-accent hover:text-accent",
  tableScroller: "w-full overflow-x-auto",
  table: "w-full md:min-w-[40rem] lg:min-w-0",
  tableHeader: `mt-6 hidden h-12 items-center ${columns} text-sm font-semibold text-muted md:grid [&>:first-child]:pl-2 lg:text-base`,
  tableBody: "mt-4 flex flex-col gap-3 md:mt-0 md:gap-4",
  tokenRow: `grid h-auto grid-cols-2 items-center gap-x-3 gap-y-3 overflow-hidden rounded-[20px] bg-surface p-3 text-sm ${columns} md:gap-0 md:px-2 md:py-2.5 md:text-base`,
  tokenIdentity:
    "col-span-2 flex min-w-0 items-center gap-3 md:col-span-1 md:pl-2",
  tokenImage:
    "block size-16 shrink-0 rounded-[10px] object-cover sm:size-20 lg:size-24",
  tokenNames:
    "flex min-w-0 flex-col gap-1 [&_strong]:truncate [&_span]:text-sm [&_span]:text-muted sm:gap-2",
  metric: "flex min-w-0 flex-col items-start gap-1 md:justify-center",
  metricLabel: "text-[11px] font-medium text-muted md:hidden",
  marketCap: "font-semibold text-accent",
  metricValue: "font-semibold whitespace-nowrap",
  change: "font-semibold text-positive",
  pairCell:
    "flex min-w-0 items-center gap-1 [&_img]:block [&_img]:shrink-0 [&_img]:rounded-full [&_img]:object-cover [&_span]:truncate",
  footer:
    "flex shrink-0 items-center gap-4 overflow-x-auto border-t border-line bg-canvas px-4 py-2 text-xs font-medium tracking-[.02em] whitespace-nowrap text-foreground/50 [scrollbar-width:none] sm:justify-between sm:px-6 sm:py-3 sm:text-sm lg:px-8 lg:text-base [&::-webkit-scrollbar]:hidden",
  footerLinks:
    "flex shrink-0 items-center gap-4 [&_a]:inline-flex [&_a]:shrink-0 [&_a]:items-center [&_a:hover]:text-foreground",
} as const;
