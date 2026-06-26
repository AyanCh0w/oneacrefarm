"use client";

import { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import { cn } from "@/lib/utils";

export interface MapFeature {
  id: string | number | undefined;
  layerId: string;
  properties: Record<string, unknown>;
  geometry: GeoJSON.Geometry;
}

interface MapboxMapProps {
  className?: string;
  initialCenter?: [number, number];
  initialZoom?: number;
  initialBearing?: number;
  initialPitch?: number;
  minZoom?: number;
  maxZoom?: number;
  maxBounds?: [[number, number], [number, number]]; // [[sw_lng, sw_lat], [ne_lng, ne_lat]]
  style?: string;
  onMapLoad?: (map: mapboxgl.Map) => void;
  onFeaturesLoad?: (features: MapFeature[]) => void;
  onFeatureClick?: (feature: MapFeature) => void;
  interactiveLayers?: string[];
  autoDiscoverLayers?: boolean;
  showFieldLabels?: boolean;
  markers?: Array<{
    id: string;
    coordinates: [number, number];
    color?: string;
    popup?: string;
  }>;
}

export function MapboxMap({
  className,
  initialCenter = [-77.451251, 39.162552],
  initialZoom = 17,
  initialBearing = -67.2,
  initialPitch = 0,
  minZoom = 16.5,
  maxZoom = 19,
  maxBounds = [
    [-77.454, 39.1605], // Southwest
    [-77.4485, 39.1645], // Northeast
  ],
  style = "mapbox://styles/ayanchow/cmkwthf8e005501qu4jcae74l",
  onMapLoad,
  onFeaturesLoad,
  onFeatureClick,
  interactiveLayers = [],
  autoDiscoverLayers = false,
  showFieldLabels = false,
  markers = [],
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<globalThis.Map<string, mapboxgl.Marker>>(
    new globalThis.Map(),
  );
  const callbacksRef = useRef({
    onMapLoad,
    onFeaturesLoad,
    onFeatureClick,
  });
  const optionsRef = useRef({
    initialCenter,
    initialZoom,
    initialBearing,
    initialPitch,
    minZoom,
    maxZoom,
    maxBounds,
    style,
    interactiveLayers,
    autoDiscoverLayers,
    showFieldLabels,
  });
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    callbacksRef.current = {
      onMapLoad,
      onFeaturesLoad,
      onFeatureClick,
    };
  }, [onMapLoad, onFeaturesLoad, onFeatureClick]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    const options = optionsRef.current;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error(
        "Mapbox token not found. Set NEXT_PUBLIC_MAPBOX_TOKEN in your environment.",
      );
      return;
    }

    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: options.style,
      center: options.initialCenter,
      zoom: options.initialZoom,
      bearing: options.initialBearing,
      pitch: options.initialPitch,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      maxBounds: options.maxBounds,
    });

    //map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      "top-right",
    );

    map.current.on("load", () => {
      setMapLoaded(true);
      const currentMap = map.current;
      if (!currentMap) return;

      callbacksRef.current.onMapLoad?.(currentMap);

      const mapStyle = currentMap.getStyle();
      const fillLayerIds =
        mapStyle?.layers
          ?.filter((layer) => layer.type === "fill" && layer.source)
          .map((layer) => layer.id) ?? [];
      const queryLayerIds = options.autoDiscoverLayers
        ? fillLayerIds
        : options.interactiveLayers;
      const queryOptions =
        queryLayerIds.length > 0 ? { layers: queryLayerIds } : undefined;

      const toMapFeature = (
        feature: mapboxgl.MapboxGeoJSONFeature,
      ): MapFeature => ({
        id: feature.id,
        layerId: feature.layer?.id || "",
        properties: feature.properties || {},
        geometry: feature.geometry,
      });

      if (callbacksRef.current.onFeaturesLoad) {
        const features = (
          queryOptions
            ? currentMap.queryRenderedFeatures(queryOptions)
            : currentMap.queryRenderedFeatures()
        ).map(toMapFeature);
        callbacksRef.current.onFeaturesLoad(features);
      }

      // Click anywhere on map to get features at that point.
      currentMap.on("click", (e) => {
        const onFeatureClick = callbacksRef.current.onFeatureClick;
        if (!onFeatureClick) return;

        const features = currentMap.queryRenderedFeatures(
          e.point,
          queryOptions,
        );
        if (features.length > 0) {
          onFeatureClick(toMapFeature(features[0]));
        }
      });

      // Add field name labels on polygons
      if (options.showFieldLabels && mapStyle?.layers) {
        // Find fill layers that might be fields.
        const fillLayers = mapStyle.layers.filter(
          (layer) => layer.type === "fill" && layer.source,
        );

        fillLayers.forEach((layer) => {
          const sourceId = layer.source as string;
          const labelLayerId = `${layer.id}-labels`;

          if (currentMap.getLayer(labelLayerId)) return;

          const sourceLayer = (layer as Record<string, unknown>)[
            "source-layer"
          ] as string | undefined;
          currentMap.addLayer({
            id: labelLayerId,
            type: "symbol",
            source: sourceId,
            ...(sourceLayer ? { "source-layer": sourceLayer } : {}),
            layout: {
              "text-field": [
                "coalesce",
                ["get", "name"],
                ["get", "Name"],
                "",
              ],
              "text-size": 12,
              "text-anchor": "center",
              "text-allow-overlap": false,
            },
            paint: {
              "text-color": "#ffffff",
              "text-halo-color": "#000000",
              "text-halo-width": 1,
            },
          });
        });
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Handle markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove markers that no longer exist
    markersRef.current.forEach((marker, id) => {
      if (!markers.find((m) => m.id === id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add or update markers
    markers.forEach((markerData) => {
      const existingMarker = markersRef.current.get(markerData.id);

      if (existingMarker) {
        existingMarker.setLngLat(markerData.coordinates);
      } else {
        const marker = new mapboxgl.Marker({
          color: markerData.color || "var(--primary)",
        })
          .setLngLat(markerData.coordinates)
          .addTo(map.current!);

        if (markerData.popup) {
          marker.setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(markerData.popup),
          );
        }

        markersRef.current.set(markerData.id, marker);
      }
    });
  }, [markers, mapLoaded]);

  return (
    <div
      ref={mapContainer}
      className={cn("w-full h-[400px] rounded-lg overflow-hidden", className)}
    />
  );
}
