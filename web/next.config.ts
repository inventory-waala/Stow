import os from "node:os";
import type { NextConfig } from "next";

const port = process.env.PORT ?? "3000";

/** Every IPv4 address this machine has right now — what a phone on the LAN uses. */
const lanHosts = Object.values(os.networkInterfaces())
  .flat()
  .filter((n): n is os.NetworkInterfaceInfo => !!n && n.family === "IPv4" && !n.internal)
  .flatMap((n) => [n.address, `${n.address}:${port}`]);

/**
 * Hosts other than localhost that may load the dev server and submit server
 * actions — a phone on the LAN, or a VS Code / dev-tunnel forwarded port.
 * Next 16 answers 403 for /_next/* assets and "Invalid Server Actions
 * request" for form posts from any other origin. Note Next's matcher only
 * allows `**` as the leftmost label; IPs must be listed literally (with the
 * port, since the Origin header carries it). Add more with
 * DEV_ORIGINS="host,host:port".
 */
const devOrigins = [
  // VS Code dev tunnels rewrite `Origin` to the local address while
  // `x-forwarded-host` names the tunnel, so "localhost" must be allowed too.
  "localhost",
  `localhost:${port}`,
  `127.0.0.1:${port}`,
  "**.devtunnels.ms",
  "**.ngrok-free.app",
  "**.ngrok.app",
  "**.trycloudflare.com",
  "**.loca.lt",
  ...lanHosts,
  ...(process.env.DEV_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? []),
];

const nextConfig: NextConfig = {
  // Don't regenerate AGENTS.md / CLAUDE.md on every `next dev`.
  agentRules: false,
  allowedDevOrigins: devOrigins,
  ...(process.env.NODE_ENV !== "production"
    ? { experimental: { serverActions: { allowedOrigins: devOrigins } } }
    : {}),
};

export default nextConfig;
