/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      { source: '/teacher', destination: '/dashboard', permanent: false },
      { source: '/teacher/course/:courseId', destination: '/dashboard/course/:courseId', permanent: false },
      { source: '/student', destination: '/', permanent: false },
      { source: '/student/chat/:courseId', destination: '/course/:courseId', permanent: false },
    ];
  },
};

export default nextConfig;
