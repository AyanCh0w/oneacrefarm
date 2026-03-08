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
        src: "/appicons/android/mipmap-xxxhdpi/Crop Logger.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/appicons/Assets.xcassets/AppIcon.appiconset/1024.png",
        sizes: "1024x1024",
        type: "image/png",
      },
      {
        src: "/appicons/android/mipmap-xxxhdpi/Crop Logger.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
