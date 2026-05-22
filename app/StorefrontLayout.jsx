'use client';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import AsideNav from '@/components/AsideNav';
import CartDrawer from '@/components/CartDrawer';

export default function StorefrontLayout({ children }) {
  const pathname = usePathname();

  if (pathname?.startsWith('/admin')) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <AsideNav />
      <CartDrawer />
      {children}
    </>
  );
}
