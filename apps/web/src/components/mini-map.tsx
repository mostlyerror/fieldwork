"use client";

import Map, { Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

export default function MiniMap({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  return (
    <div className="h-[250px] w-full">
      <Map
        initialViewState={{
          latitude,
          longitude,
          zoom: 13,
        }}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
        interactive={false}
        attributionControl={false}
      >
        <Marker longitude={longitude} latitude={latitude} anchor="bottom">
          <span className="text-2xl">📍</span>
        </Marker>
      </Map>
    </div>
  );
}
