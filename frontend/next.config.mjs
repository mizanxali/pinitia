/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "places.googleapis.com",
      },
    ],
  },
};

export default nextConfig;
