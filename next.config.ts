import type { NextConfig } from "next";

// Los activos 3D llevan versión en el nombre (model-v1.glb), así que pueden cachearse de forma inmutable.
const immutable = "public, max-age=31536000, immutable";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/models/:path*",
        headers: [{ key: "Cache-Control", value: immutable }],
      },
      {
        source: "/models/:slug/:file(.*\\.glb)",
        headers: [{ key: "Content-Type", value: "model/gltf-binary" }],
      },
      {
        source: "/environments/:path*",
        headers: [{ key: "Cache-Control", value: immutable }],
      },
    ];
  },
};

export default nextConfig;
