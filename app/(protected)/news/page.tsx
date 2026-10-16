import { NewsView } from "@/components/news-view";
import { requireCurrentUser } from "@/lib/auth";

export default async function NewsPage() {
  await requireCurrentUser();
  return <NewsView />;
}
