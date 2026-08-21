import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TEMP: enabled to resolve a minified React #185 stack trace from a live
  // incident (portal crashing right after subscription activation) into
  // real file/line names. Exposes source structure publicly while on —
  // revert once the incident is diagnosed.
  productionBrowserSourceMaps: true,
};

export default nextConfig;
