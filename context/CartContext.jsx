'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { getVisitorId } from '@/lib/analytics/visitor';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [sessionUserId, setSessionUserId] = useState(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      setSessionUserId(data?.session?.user?.id || null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSessionUserId(nextSession?.user?.id || null);
    });

    return () => {
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('extraCart');
    if (stored) setCart(JSON.parse(stored));
  }, []);

  // Persist whenever cart changes
  useEffect(() => {
    localStorage.setItem('extraCart', JSON.stringify(cart));
    // Fire storage event so other tabs sync
    window.dispatchEvent(new Event('storage'));
  }, [cart]);

  const trackAddToCart = useCallback((item) => {
    try {
      const visitorId = getVisitorId();
      const productId = item?.productId || null;
      const variantId = item?.variantId || null;
      const qty = Number(item?.qty || 1);
      if (!visitorId || !productId || !qty || qty <= 0) return;

      const key = `extra_cart_evt_v1:${visitorId}:${productId}:${variantId || 'none'}`;
      const now = Date.now();
      const last = Number(sessionStorage.getItem(key) || 0);
      if (last && now - last < 2500) return; // throttle fast double clicks
      sessionStorage.setItem(key, String(now));

      const supabase = createClient();
      // Fire and forget; never block the UX.
      setTimeout(() => {
        supabase
          .from('cart_events')
          .insert({
            visitor_id: visitorId,
            user_id: sessionUserId,
            product_id: productId,
            variant_id: variantId,
            quantity: qty,
          })
          .then(() => {});
      }, 0);
    } catch {
      // ignore
    }
  }, [sessionUserId]);

  const addToCart = useCallback((item) => {
    trackAddToCart(item);
    setCart(prev => {
      const existing = prev.find(i => i.name === item.name && i.size === item.size);
      if (existing) {
        return prev.map(i =>
          i.name === item.name && i.size === item.size
            ? { ...i, qty: i.qty + item.qty }
            : i
        );
      }
      return [...prev, item];
    });
  }, []);

  const removeFromCart = useCallback((index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const totalItems = cart.reduce((sum, i) => sum + i.qty, 0);
  const totalPrice = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

  const openCart  = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);

  return (
    <CartContext.Provider value={{
      cart, addToCart, removeFromCart, clearCart,
      totalItems, totalPrice,
      isOpen, openCart, closeCart
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
