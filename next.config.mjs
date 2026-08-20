import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* The dev-mode indicator is a fixed-position badge that sits over the
     rail's navigation and lands in every verification screenshot. It has
     no production equivalent, so hiding it removes an artefact rather
     than any real signal. */
  devIndicators: false,

  // Set the "@/..." alias explicitly. Relying on tsconfig `paths`
  // alone proved unreliable here, and this is resolver-independent.
  webpack: (config) => {
    config.resolve.alias['@'] = path.join(dir, 'src');
    return config;
  },
  turbopack: {
    resolveAlias: { '@/*': './src/*' },
  },
};

export default nextConfig;
