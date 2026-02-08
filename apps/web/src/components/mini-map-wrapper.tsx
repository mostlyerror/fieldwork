"use client";

import dynamic from "next/dynamic";

const MiniMap = dynamic(() => import("./mini-map"), { ssr: false });

export function MiniMapWrapper({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  return <MiniMap latitude={latitude} longitude={longitude} />;
}
