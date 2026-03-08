import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Crop Logger – One Acre Farm",
    short_name: "Crop Logger",
    description: "One Acre Farm crop quality tracking and data collection",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "any",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
