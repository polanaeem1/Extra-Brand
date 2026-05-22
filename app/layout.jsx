import './globals.css';
import '@/styles/cart-drawer.css';

import { AsideProvider } from '@/context/AsideContext';
import { CartProvider } from '@/context/CartContext';
import Script from 'next/script';
import StorefrontLayout from './StorefrontLayout';
import PageViewTracker from '@/components/PageViewTracker';

export const metadata = {
  title: 'EXTRA',
  description: 'ALWAYS EXTRA.. NEVER BASIC',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <AsideProvider>
            <StorefrontLayout>
              <PageViewTracker />
              {children}
            </StorefrontLayout>
          </AsideProvider>
        </CartProvider>
        <Script type="module" src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js" />
        <Script noModule src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js" />
      </body>
    </html>
  );
}
