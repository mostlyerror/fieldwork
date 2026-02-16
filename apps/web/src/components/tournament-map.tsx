"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import Map, { Marker, type MapRef } from "react-map-gl/maplibre";
import type { Map as MaplibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Supercluster from "supercluster";
import type { Tournament } from "@/lib/types";
import { DEFAULT_MAP_VIEW } from "@/lib/constants";
import { TournamentMapPopup } from "./tournament-map-popup";

interface PointProperties {
  cluster: false;
  tournament: Tournament;
}

interface ClusterProperties {
  cluster: true;
  cluster_id: number;
  point_count: number;
}

type PointFeature = GeoJSON.Feature<
  GeoJSON.Point,
  PointProperties | ClusterProperties
>;

export default function TournamentMap({
  tournaments,
  citySlug,
}: {
  tournaments: Tournament[];
  citySlug?: string;
}) {
  const mapRef = useRef<MapRef>(null);
  const [bounds, setBounds] = useState<[number, number, number, number]>([
    -96.5, 29.0, -94.5, 30.5,
  ]);
  const [zoom, setZoom] = useState<number>(DEFAULT_MAP_VIEW.zoom);
  const [selected, setSelected] = useState<Tournament | null>(null);

  const points: GeoJSON.Feature<GeoJSON.Point, PointProperties>[] =
    useMemo(() => {
      return tournaments
        .filter((t) => t.latitude != null && t.longitude != null)
        .map((t) => ({
          type: "Feature" as const,
          properties: { cluster: false as const, tournament: t },
          geometry: {
            type: "Point" as const,
            coordinates: [t.longitude!, t.latitude!],
          },
        }));
    }, [tournaments]);

  const index = useMemo(() => {
    const sc = new Supercluster<PointProperties, ClusterProperties>({
      radius: 60,
      maxZoom: 16,
    });
    sc.load(points);
    return sc;
  }, [points]);

  const clusters = useMemo(() => {
    return index.getClusters(bounds, Math.floor(zoom)) as PointFeature[];
  }, [index, bounds, zoom]);

  const onMove = useCallback(() => {
    const map = mapRef.current?.getMap() as MaplibreMap | undefined;
    if (!map) return;
    const b = map.getBounds();
    setBounds([
      b.getWest(),
      b.getSouth(),
      b.getEast(),
      b.getNorth(),
    ]);
    setZoom(map.getZoom());
  }, []);

  const handleClusterClick = useCallback(
    (clusterId: number, lng: number, lat: number) => {
      const expansionZoom = Math.min(index.getClusterExpansionZoom(clusterId), 16);
      mapRef.current?.flyTo({ center: [lng, lat], zoom: expansionZoom, duration: 500 });
    },
    [index]
  );

  return (
    <div className="h-[calc(100vh-280px)] min-h-[400px] overflow-hidden rounded-lg border border-gray-200">
      <Map
        ref={mapRef}
        initialViewState={DEFAULT_MAP_VIEW}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
        onMoveEnd={onMove}
        onLoad={onMove}
      >
        {clusters.map((feature) => {
          const [lng, lat] = feature.geometry.coordinates;
          const props = feature.properties;

          if (props.cluster) {
            const size = Math.min(
              24 + (props.point_count / points.length) * 40,
              56
            );
            return (
              <Marker
                key={`cluster-${props.cluster_id}`}
                longitude={lng}
                latitude={lat}
                anchor="center"
              >
                <button
                  className="flex items-center justify-center rounded-full bg-green-600 font-bold text-white shadow-lg"
                  style={{ width: size, height: size }}
                  onClick={() =>
                    handleClusterClick(props.cluster_id, lng, lat)
                  }
                >
                  {props.point_count}
                </button>
              </Marker>
            );
          }

          return (
            <Marker
              key={props.tournament.id}
              longitude={lng}
              latitude={lat}
              anchor="bottom"
            >
              <button
                onClick={() => setSelected(props.tournament)}
                className="text-2xl drop-shadow-md transition hover:scale-110"
                aria-label={`View ${props.tournament.name}`}
              >
                📍
              </button>
            </Marker>
          );
        })}

        {selected && (
          <TournamentMapPopup
            tournament={selected}
            onClose={() => setSelected(null)}
            citySlug={citySlug}
          />
        )}
      </Map>
    </div>
  );
}
