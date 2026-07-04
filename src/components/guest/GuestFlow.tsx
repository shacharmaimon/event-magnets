"use client";

import { useEffect, useRef, useState } from "react";
import WelcomeScreen from "@/components/guest/WelcomeScreen";
import CaptureStep from "@/components/guest/CaptureStep";
import FramePicker from "@/components/guest/FramePicker";
import ConfirmStep from "@/components/guest/ConfirmStep";
import { detectOrientation } from "@/lib/orientation";
import { getDeviceId } from "@/lib/device-id";
import type { Orientation, PublicEventData, PublicFrame } from "@/lib/types";

type Step = "welcome" | "capture" | "framing" | "confirm" | "done";

// Client-side state machine for the guest experience.
export default function GuestFlow({ event }: { event: PublicEventData }) {
  const [step, setStep] = useState<Step>("welcome");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<Orientation | null>(null);
  const [chosenFrame, setChosenFrame] = useState<PublicFrame | null>(null);
  const [deviceId, setDeviceId] = useState("");

  // Track the object URL so we can revoke it (avoid memory leaks on retake).
  const objectUrl = useRef<string | null>(null);

  useEffect(() => {
    setDeviceId(getDeviceId());
    return () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    };
  }, []);

  async function handlePhoto(file: File) {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const url = URL.createObjectURL(file);
    objectUrl.current = url;

    const o = await detectOrientation(file);
    setPhotoFile(file);
    setPhotoUrl(url);
    setOrientation(o);
    setChosenFrame(null);
    setStep("framing");
  }

  function retake() {
    setStep("capture");
  }

  if (step === "welcome") {
    return (
      <WelcomeScreen
        heading={event.welcome_heading}
        subheading={event.welcome_subheading}
        onStart={() => setStep("capture")}
      />
    );
  }

  if (step === "capture") {
    return <CaptureStep onPhoto={handlePhoto} />;
  }

  if (step === "framing" && photoUrl && orientation) {
    const frames = event.frames[orientation];
    return (
      <FramePicker
        photoUrl={photoUrl}
        orientation={orientation}
        frames={frames}
        onChoose={(frame) => {
          setChosenFrame(frame);
          setStep("confirm");
        }}
        onRetake={retake}
      />
    );
  }

  if (
    step === "confirm" &&
    photoFile &&
    photoUrl &&
    orientation &&
    chosenFrame
  ) {
    return (
      <ConfirmStep
        slug={event.public_slug}
        photoFile={photoFile}
        photoUrl={photoUrl}
        frame={chosenFrame}
        orientation={orientation}
        deviceId={deviceId}
        onRetake={retake}
        onDone={() => setStep("done")}
      />
    );
  }

  if (step === "done") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <p className="text-xl font-semibold text-zinc-900 dark:text-white">
          🎉
        </p>
      </main>
    );
  }

  // Fallback (e.g. state mismatch) — return to welcome.
  return (
    <WelcomeScreen
      heading={event.welcome_heading}
      subheading={event.welcome_subheading}
      onStart={() => setStep("capture")}
    />
  );
}
