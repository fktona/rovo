// Previous market columns: Token, MCAP, 24h Vol, Date Created, 24h, Paired with.
const columns =
  "md:grid-cols-[minmax(11rem,1.8fr)_minmax(6.5rem,0.9fr)_minmax(7rem,1fr)_minmax(5.5rem,0.9fr)_minmax(6.5rem,1fr)]";

export const styles = {
  srOnly: "sr-only",
  dashboard: "flex min-h-full flex-col bg-black text-base",
  navLinkActive: "bg-[#191919] text-[#ccff00] hover:bg-[#191919]",
  header:
    "relative grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 px-4 py-3 md:flex md:flex-nowrap md:gap-3 lg:gap-4 lg:px-8 lg:py-5",
  searchBox:
    "col-span-2 flex h-11 w-full min-w-0 items-center gap-2 rounded-xl bg-[#191919] px-3.5 md:order-1 md:col-auto md:h-10 md:w-auto md:flex-1 lg:mx-auto lg:max-w-md [&_img]:shrink-0",
  searchInput:
    "w-full min-w-0 border-0 bg-transparent text-sm text-white outline-none placeholder:text-[#7f7f7f] [&::-webkit-search-cancel-button]:cursor-pointer",
  loginButton:
    "shrink-0 whitespace-nowrap rounded-[10px] bg-[#ccff00] px-3 py-1 text-xs font-medium text-black hover:bg-[#d8ff43] md:px-4 md:py-2 md:text-sm",
  main: "min-h-full flex-1 flex-col px-4 sm:px-6 lg:px-8",
  assetBar:
    "flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-6 lg:py-5",
  allSelector: "inline-flex shrink-0 items-center gap-1",
  assetSelect:
    "w-auto cursor-pointer appearance-none border-0 bg-transparent p-0 text-base text-white outline-none [&_option]:bg-[#191919]",
  pairFilters:
    "flex min-w-0 items-center gap-3 overflow-x-auto [scrollbar-width:none] sm:gap-5 lg:gap-6 [&::-webkit-scrollbar]:hidden",
  pairFilter:
    "flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border-0 px-2 py-1.5 text-sm text-white hover:bg-[#191919] sm:text-base [&_img]:block [&_img]:shrink-0 [&_img]:object-contain",
  pairFilterActive: "bg-[#191919] px-2",
  tablePanel:
    "flex flex-1 flex-col overflow-hidden rounded-t-[20px] border border-[#383838] border-b-0 p-4 pb-8 sm:p-5 sm:pb-9",
  viewTabs:
    "flex items-center gap-3 overflow-x-auto [scrollbar-width:none] sm:gap-6 [&::-webkit-scrollbar]:hidden",
  viewTab:
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-medium text-white hover:text-[#ccff00] sm:text-base [&_img]:block [&_img]:shrink-0",
  viewTabActive: "border border-[#383838] bg-[#191919] px-3 hover:text-white",
  tableScroller: "w-full overflow-x-auto",
  table: "w-full md:min-w-[40rem] lg:min-w-0",
  tableHeader: `mt-6 hidden h-12 items-center ${columns} text-sm font-semibold text-[#737373] md:grid [&>:first-child]:pl-2 lg:text-base`,
  tableBody: "mt-4 flex flex-col gap-3 md:mt-0 md:gap-4",
  tokenRow: `grid h-auto grid-cols-2 items-center gap-x-3 gap-y-3 overflow-hidden rounded-[20px] bg-[#191919] p-3 text-sm ${columns} md:gap-0 md:px-2 md:py-2.5 md:text-base`,
  tokenIdentity:
    "col-span-2 flex min-w-0 items-center gap-3 md:col-span-1 md:pl-2",
  tokenImage:
    "block size-16 shrink-0 rounded-[10px] object-cover sm:size-20 lg:size-24",
  tokenNames:
    "flex min-w-0 flex-col gap-1 [&_strong]:truncate [&_span]:text-sm [&_span]:text-[#737373] sm:gap-2",
  metric: "flex min-w-0 flex-col items-start gap-1 md:justify-center",
  metricLabel: "text-[11px] font-medium text-[#737373] md:hidden",
  marketCap: "font-semibold text-[#ccff00]",
  metricValue: "font-semibold",
  dateCell: "md:flex-col md:items-center md:gap-1",
  dateAge: "text-[11px] text-[#737373] sm:text-sm",
  change: "font-semibold text-[#34c759]",
  pairCell:
    "flex min-w-0 items-center gap-1 [&_img]:block [&_img]:shrink-0 [&_img]:rounded-full [&_img]:object-cover [&_span]:truncate",
  footer:
    "flex shrink-0 items-center gap-4 overflow-x-auto border-t border-[#383838] bg-black px-4 py-2 text-xs font-medium tracking-[.02em] whitespace-nowrap text-white/50 [scrollbar-width:none] sm:justify-between sm:px-6 sm:py-3 sm:text-sm lg:px-8 lg:text-base [&::-webkit-scrollbar]:hidden",
  footerLinks:
    "flex shrink-0 items-center gap-4 [&_a]:inline-flex [&_a]:shrink-0 [&_a]:items-center [&_a:hover]:text-white",
} as const;
