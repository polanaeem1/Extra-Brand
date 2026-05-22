'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

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

  const addToCart = useCallback((item) => {
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
