export function isAdminWallet(
  address?: string | null,
  admin = process.env.NEXT_PUBLIC_ADMIN_WALLET,
) {
  const expected = admin?.trim();
  const actual = address?.trim();
  if (!expected || !actual) return false;
  return actual === expected;
}
