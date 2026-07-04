import { getPublicEventData } from "@/lib/public-event";
import GuestFlow from "@/components/guest/GuestFlow";
import UnavailableScreen from "@/components/guest/UnavailableScreen";

// Guest entry point (the QR/link target). Server component: fetches the safe
// public event data; if the event is missing or closed, shows the unavailable
// screen. Otherwise hands off to the interactive GuestFlow.
export default async function GuestEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getPublicEventData(slug);

  if (!event) {
    return <UnavailableScreen />;
  }

  return <GuestFlow event={event} />;
}
