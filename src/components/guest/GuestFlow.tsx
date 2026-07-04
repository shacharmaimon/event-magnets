"use client";

import { useEffect, useRef, useState } from "react";
import WelcomeScreen from "@/components/guest/WelcomeScreen";
import CaptureStep from "@/components/guest/CaptureStep";
import FramePicker from "@/components/guest/FramePicker";
import ConfirmStep from "@/components/guest/ConfirmStep";
import { detectOrientation } from "@/lib/orientation";
import { getDeviceId } from "@/lib/device-id";
import { labels } from "@/lib/labels";
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
  const [finishedUrl, setFinishedUrl] = useState<string | null>(null);

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
        onDone={(url) => {
          setFinishedUrl(url);
          setStep("done");
        }}
      />
    );
  }

  if (step === "done") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {labels.guest.doneTitle}
        </h2>
        {finishedUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={finishedUrl}
            alt=""
            className="mx-auto w-full max-w-sm rounded-xl shadow-lg"
          />
        )}
        <p className="text-zinc-500 dark:text-zinc-400">
          {labels.guest.doneBody}
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
