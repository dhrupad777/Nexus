import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Ticket cover images live in Firebase Storage. Without this allow-list,
    // `<Image>` refuses to load them in production.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/v0/b/**",
      },
    ],
  },
};

export default nextConfig;
