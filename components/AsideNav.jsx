'use client';
import Link from 'next/link';
import { useAside } from '@/context/AsideContext';
import { useRouter } from 'next/navigation';

export default function AsideNav() {
  const { isOpen, closeAside } = useAside();
  const router = useRouter();

  function handleShopAll(e) {
    e.preventDefault();
    closeAside();
    setTimeout(() => {
      const el = document.getElementById('shop');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      else router.push('/#shop');
    }, 450);
  }

  return (
    <>
      <aside className={`aside-nav${isOpen ? ' open' : ''}`} id="asideNav">
        <div className="aside-header">
          <div className="aside-logo">
            <video autoPlay muted loop playsInline className="aside-logo-video">
              <source src="/assets/Videos/ComfyUI_00003_.mp4" type="video/mp4" />
            </video>
          </div>
          <ion-icon
            name="close-outline"
            className="aside-close"
            id="asideClose"
            onClick={closeAside}
          ></ion-icon>
        </div>
        <ul className="aside-links">
          <li><Link href="/" onClick={closeAside}>Home</Link></li>
          <li><a href="/#shop" onClick={handleShopAll}>Shop All</a></li>
          <li><Link href="/contact" onClick={closeAside}>Contact Us</Link></li>
          <li><Link href="/policies" onClick={closeAside}>Policies</Link></li>
        </ul>
      </aside>
      <div
        className={`aside-overlay${isOpen ? ' open' : ''}`}
        id="asideOverlay"
        onClick={closeAside}
      />
    </>
  );
}
