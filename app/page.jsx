'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Footer from '@/components/Footer';
import { fetchProducts } from '@/lib/supabase/catalog';
import { createClient } from '@/lib/supabase/browser';
import '@/styles/pages/home.css';

const socialLinks = [
  { href: 'https://www.instagram.com/extra.styling?igsh=emplOWhiaGFvcnlt', icon: 'logo-instagram', label: 'Instagram' },
  // TODO: replace with your official Facebook page URL.
  { href: 'https://www.facebook.com/', icon: 'logo-facebook', label: 'Facebook' },
  { href: 'https://www.tiktok.com/@extra.styling?_r=1&_t=ZS-96QITrolAuK', icon: 'logo-tiktok', label: 'TikTok' },
];

export default function Home() {
  const successRef = useRef(null);
  const [email, setEmail] = useState('');
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  
  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    const refresh = () =>
      fetchProducts().then((nextProducts) => {
        if (!isMounted) return;
        setProducts(nextProducts);
        setIsLoadingProducts(false);
      });

    refresh();

    const channel = supabase
      .channel('public:products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_images' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_variants' }, refresh)
      .subscribe();

    const intervalId = window.setInterval(refresh, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const productFrames = document.querySelectorAll('.product-frame');
    const productNames  = document.querySelectorAll('.product-name');
    const productPrices = document.querySelectorAll('.product-price');

    const frameObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          frameObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    const nameObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          nameObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.8 });

    const priceObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          priceObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.8 });

    productFrames.forEach(el => frameObserver.observe(el));
    productNames.forEach(el => nameObserver.observe(el));
    productPrices.forEach(el => priceObserver.observe(el));

    return () => {
      frameObserver.disconnect();
      nameObserver.disconnect();
      priceObserver.disconnect();
    };
  }, [products]);

  const handleNewsletter = () => {
    if (!successRef.current) return;
    if (!email.trim() || !email.includes("@")) {
      successRef.current.textContent = "PLEASE ENTER A VALID EMAIL.";
      successRef.current.style.color = "#ff4444";
      successRef.current.classList.add("show");
      return;
    }
    setEmail('');
    successRef.current.textContent = "✓ YOU'RE ON THE LIST!";
    successRef.current.style.color = "var(--silver)";
    successRef.current.classList.add("show");
    setTimeout(() => {
      if(successRef.current) successRef.current.classList.remove("show");
    }, 4000);
  };

  return (
    <>
      <section className="hero" id="top">
        <div className="overlay"></div>
        <div className="hero-content">
          <h1>ALWAYS EXTRA..<br/>NEVER BASIC</h1>
          <a href="#shop" className="cta">SHOP NOW ⟶</a>
        </div>
        <div className="socials">
          {socialLinks.map((link) => (
            <a key={link.icon} href={link.href} target="_blank" rel="noreferrer" aria-label={link.label}>
              <ion-icon name={link.icon}></ion-icon>
            </a>
          ))}
        </div>
      </section>

      <div className="ticker-wrap">
        <div className="ticker-track">
          <span>NEW DROP</span><span>✦</span>
          <span>NEW DROP</span><span>✦</span>
          <span>NEW DROP</span><span>✦</span>
          <span>NEW DROP</span><span>✦</span>
          <span>NEW DROP</span><span>✦</span>
          <span>NEW DROP</span><span>✦</span>
          <span>NEW DROP</span><span>✦</span>
          <span>NEW DROP</span><span>✦</span>
        </div>
      </div>

      <section className="products-section" id="shop">
        <div className="products-header">
          <p className="products-label">✦ NEW DROP ✦</p>
        </div>

        {isLoadingProducts && (
          <p className="products-empty">LOADING THE LATEST DROP...</p>
        )}

        {!isLoadingProducts && products.length === 0 && (
          <div className="products-empty-wrap">
            <p className="products-empty">NO PRODUCTS AVAILABLE RIGHT NOW.</p>
            <Link href="/contact" className="product-empty-cta">CONTACT US</Link>
          </div>
        )}

        {products.map((product, index) => (
          <Link href={`/product/${product.slug || product.id || index + 1}`} className="product-card" key={product.id || product.title}>
            <div className="product-frame">
              {product.images?.[0] ? (
                <img src={product.images[0]} alt={product.title} />
              ) : (
                <div className="product-image-missing">NO IMAGE</div>
              )}
              <div className="product-cta-wrap">
                <span className="product-cta">SHOP NOW ⟶</span>
              </div>
            </div>
            <div className="product-info">
              <h3 className="product-name">{product.title}</h3>
              <p className="product-price">{product.priceLabel}</p>
            </div>
          </Link>
        ))}
      </section>

      <section className="insta-section">
        <div className="insta-header">
          <p className="insta-label">✦ FOLLOW US ✦</p>
          <h2 className="insta-title">FOLLOW US ON INSTAGRAM <span>@EXTRA.Styling</span></h2>
        </div>
        <div className="insta-slider-wrap">
          <div className="insta-slider" id="instaSlider">
            <a href="https://www.instagram.com/extra.styling?igsh=emplOWhiaGFvcnlt" target="_blank" className="insta-card" rel="noreferrer"><img src="/assets/images/insta-1.jpeg" alt="EXTRA Instagram lookbook 1" /></a>
            <a href="https://www.instagram.com/extra.styling?igsh=emplOWhiaGFvcnlt" target="_blank" className="insta-card" rel="noreferrer"><img src="/assets/images/insta-2.jpeg" alt="EXTRA Instagram lookbook 2" /></a>
            <a href="https://www.instagram.com/extra.styling?igsh=emplOWhiaGFvcnlt" target="_blank" className="insta-card" rel="noreferrer"><img src="/assets/images/insta-3.jpeg" alt="EXTRA Instagram lookbook 3" /></a>
            <a href="https://www.instagram.com/extra.styling?igsh=emplOWhiaGFvcnlt" target="_blank" className="insta-card" rel="noreferrer"><img src="/assets/images/insta-4.jpeg" alt="EXTRA Instagram lookbook 4" /></a>
            <a href="https://www.instagram.com/extra.styling?igsh=emplOWhiaGFvcnlt" target="_blank" className="insta-card" rel="noreferrer"><img src="/assets/images/insta-5.jpeg" alt="EXTRA Instagram lookbook 5" /></a>
            <a href="https://www.instagram.com/extra.styling?igsh=emplOWhiaGFvcnlt" target="_blank" className="insta-card" rel="noreferrer"><img src="/assets/images/insta-6.jpeg" alt="EXTRA Instagram lookbook 6" /></a>
            <a href="https://www.instagram.com/extra.styling?igsh=emplOWhiaGFvcnlt" target="_blank" className="insta-card" rel="noreferrer"><img src="/assets/images/insta-1.jpeg" alt="EXTRA Instagram lookbook 1 repeat" /></a>
            <a href="https://www.instagram.com/extra.styling?igsh=emplOWhiaGFvcnlt" target="_blank" className="insta-card" rel="noreferrer"><img src="/assets/images/insta-2.jpeg" alt="EXTRA Instagram lookbook 2 repeat" /></a>
            <a href="https://www.instagram.com/extra.styling?igsh=emplOWhiaGFvcnlt" target="_blank" className="insta-card" rel="noreferrer"><img src="/assets/images/insta-3.jpeg" alt="EXTRA Instagram lookbook 3 repeat" /></a>
            <a href="https://www.instagram.com/extra.styling?igsh=emplOWhiaGFvcnlt" target="_blank" className="insta-card" rel="noreferrer"><img src="/assets/images/insta-4.jpeg" alt="EXTRA Instagram lookbook 4 repeat" /></a>
            <a href="https://www.instagram.com/extra.styling?igsh=emplOWhiaGFvcnlt" target="_blank" className="insta-card" rel="noreferrer"><img src="/assets/images/insta-5.jpeg" alt="EXTRA Instagram lookbook 5 repeat" /></a>
            <a href="https://www.instagram.com/extra.styling?igsh=emplOWhiaGFvcnlt" target="_blank" className="insta-card" rel="noreferrer"><img src="/assets/images/insta-6.jpeg" alt="EXTRA Instagram lookbook 6 repeat" /></a>
          </div>
        </div>
        <a href="https://www.instagram.com/extra.styling?igsh=emplOWhiaGFvcnlt" target="_blank" className="insta-btn" rel="noreferrer">
          <ion-icon name="logo-instagram"></ion-icon>
          FOLLOW US
        </a>
      </section>

      <section className="newsletter-section">
        <p className="newsletter-label">✦ SIGNUP NOW ✦</p>
        <h2 className="newsletter-title">GET EARLY ACCESS<br/>AND OFFERS</h2>
        <div className="newsletter-form">
          <input 
            type="email" 
            className="newsletter-input" 
            placeholder="YOUR EMAIL ADDRESS" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="newsletter-btn" id="newsletterBtn" onClick={handleNewsletter}>SUBSCRIBE</button>
        </div>
        <p className="newsletter-success" id="newsletterSuccess" ref={successRef}></p>
      </section>

      <Footer />
    </>
  );
}
