import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "One Acre Farm Crop Logger",
    short_name: "One Acre",
    description: "One Acre Farm crop quality tracking and data collection",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "any",
    icons: [
      {
        src: "/AppIcons/android/mipmap-xxxhdpi/Crop Logger.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/AppIcons/Assets.xcassets/AppIcon.appiconset/1024.png",
        sizes: "1024x1024",
        type: "image/png",
      },
      {
        src: "/AppIcons/android/mipmap-xxxhdpi/Crop Logger.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
