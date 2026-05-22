'use client';
import { createContext, useContext, useState } from 'react';

const AsideContext = createContext(null);

export function AsideProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  const openAside  = () => { setIsOpen(true);  document.body.style.overflow = 'hidden'; };
  const closeAside = () => { setIsOpen(false); document.body.style.overflow = ''; };

  return (
    <AsideContext.Provider value={{ isOpen, openAside, closeAside }}>
      {children}
    </AsideContext.Provider>
  );
}

export function useAside() {
  return useContext(AsideContext);
}
