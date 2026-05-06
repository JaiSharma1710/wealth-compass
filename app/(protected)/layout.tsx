import { ProtectedShell } from "@/components/protected-shell";
import { requireCurrentUser } from "@/lib/auth";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireCurrentUser();

  return <ProtectedShell user={user}>{children}</ProtectedShell>;
}
