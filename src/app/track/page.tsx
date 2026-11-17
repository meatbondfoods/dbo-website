import type { Metadata } from "next";
import { TrackForm } from "@/components/TrackForm";

export const metadata: Metadata = { title: "Track your order" };

export default function TrackPage() {
  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="text-4xl">Track your order</h1>
      <p className="mb-8 mt-2 text-sm text-charcoal/65">Enter your order number and the mobile number used at checkout.</p>
      <TrackForm />
    </div>
  );
}
