import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Professional Analytics | The Real Estate Agent",
  description: "Full-page real-estate sales activity, lead, inventory, and property-interaction analytics.",
};

export default function AnalysisLayout({ children }: { children: React.ReactNode }) {
  return children;
}
