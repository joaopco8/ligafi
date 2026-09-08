/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Builds de verificação usam outro diretório para não derrubar o `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  webpack: (config) => {
    // web3.js 1.x e dependências puxam módulos de Node que não existem no browser.
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, os: false, path: false, crypto: false };
    return config;
  },
};

export default nextConfig;
