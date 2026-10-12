import { redirect } from "next/navigation";

// The stocks page now lists every holding; keep old links working.
export default function StockHoldingsPage() {
  redirect("/stocks");
}
