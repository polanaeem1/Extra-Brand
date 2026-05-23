/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  async redirects() {
    return [
      {
        source: '/admin/login',
        destination: '/login?next=/admin',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
