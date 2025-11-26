/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['mapbox-gl', 'react-map-gl'],
  webpack: (config) => {
    config.externals = [...(config.externals || []), 'bluetooth-hci-socket', '@abandonware/noble'];
    return config;
  },
}

module.exports = nextConfig
