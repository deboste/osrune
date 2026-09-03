/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@osrune/engine", "@osrune/shared", "@osrune/content", "@osrune/chronicler", "@osrune/db", "@osrune/catchup"],
};

export default nextConfig;
