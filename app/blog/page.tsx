import type { Metadata } from "next";
import { JournalIndex } from "@/components/JournalIndex";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    title: "Published posts",
    description: settings.description,
    alternates: { canonical: "/blog/" },
  };
}

export default function BlogPage() {
  return <JournalIndex />;
}
