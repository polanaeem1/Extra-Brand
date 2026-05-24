'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchProductById } from '@/lib/supabase/catalog';
import { createClient } from '@/lib/supabase/browser';
import { useCart } from '@/context/CartContext';
import { saveCheckout } from '@/lib/checkout';
import '@/styles/pages/product.css';

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const { addToCart, openCart } = useCart();
  
  const id = params.id || '1';
  const [product, setProduct] = useState(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [qty, setQty] = useState(1);
  const [lowStockMsg, setLowStockMsg] = useState('');
  const [openAccordion, setOpenAccordion] = useState(null);
  
  const galleryMainRef = useRef(null);
  const flyItemRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadProduct = () => {
      fetchProductById(id).then((nextProduct) => {
        if (!isMounted) return;
        setProduct(nextProduct);
        setIsLoadingProduct(false);
        setCurrentIndex(0);
        setSize('');
        setColor('');
        setQty(1);
      });
    };

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!product?.id) return;

    let isMounted = true;
    let refreshTimer = null;
    const supabase = createClient();
    const refreshProduct = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        fetchProductById(product.id, { force: true }).then((nextProduct) => {
          if (!isMounted || !nextProduct) return;
          setProduct(nextProduct);
        });
      }, 750);
    };

    const channel = supabase
      .channel(`product-detail:${product.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `id=eq.${product.id}` }, refreshProduct)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_variants', filter: `product_id=eq.${product.id}` }, refreshProduct)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_colors', filter: `product_id=eq.${product.id}` }, refreshProduct)
      .subscribe();

    return () => {
      isMounted = false;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [product?.id]);

  if (isLoadingProduct) {
    return (
      <main className="product-page">
        <div className="product-status">LOADING PRODUCT...</div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="product-page">
        <div className="product-status">PRODUCT NOT FOUND.</div>
      </main>
    );
  }

  const totalImages = product.images.length;
  const selectedVariant = product.variants?.find((variant) => variant.size === size);
  const availableSizes = product.variants?.length
    ? product.variants.filter((variant) => variant.stock > 0).map((variant) => variant.size)
    : [];
  const availableColors = product.colorVariants?.length
    ? product.colorVariants.filter((variant) => variant.stock > 0).map((variant) => variant.color)
    : [];
  const requiresColor = availableColors.length > 0;
  const selectedColorVariant = product.colorVariants?.find((variant) => variant.color === color);
  const totalVariantStock = product.variants?.reduce((sum, variant) => sum + Number(variant.stock || 0), 0) || 0;
  const totalColorStock = product.colorVariants?.reduce((sum, variant) => sum + Number(variant.stock || 0), 0) || 0;
  const stockCandidates = [
    selectedVariant ? Number(selectedVariant.stock || 0) : null,
    selectedColorVariant ? Number(selectedColorVariant.stock || 0) : null,
  ].filter((value) => Number.isFinite(value));
  const remainingStock = stockCandidates.length
    ? Math.min(...stockCandidates)
    : (totalVariantStock || totalColorStock);
  const showLowStockCount = !lowStockMsg && remainingStock > 0 && remainingStock < 10;

  const goToImage = (index) => {
    if (!totalImages) return;
    const newIndex = (index + totalImages) % totalImages;
    setCurrentIndex(newIndex);
    if (galleryMainRef.current) {
      galleryMainRef.current.scrollTo({
        left: newIndex * galleryMainRef.current.offsetWidth,
        behavior: 'smooth'
      });
    }
  };

  const handleScroll = () => {
    if (galleryMainRef.current) {
      const index = Math.round(galleryMainRef.current.scrollLeft / galleryMainRef.current.offsetWidth);
      if (index !== currentIndex) {
        setCurrentIndex(index);
      }
    }
  };

  const flyAnimation = (callback) => {
    const btnCart = document.querySelector('.btn-cart');
    const bagIcon = document.querySelector(".nav-icons ion-icon[name='bag-outline']");
    if (!btnCart || !bagIcon || !flyItemRef.current) return callback();

    const btnRect = btnCart.getBoundingClientRect();
    const bagRect = bagIcon.getBoundingClientRect();

    flyItemRef.current.style.left = `${btnRect.left + btnRect.width / 2}px`;
    flyItemRef.current.style.top = `${btnRect.top + btnRect.height / 2}px`;
    flyItemRef.current.style.opacity = '1';
    flyItemRef.current.style.transform = 'scale(1)';
    flyItemRef.current.style.transition = 'none';

    requestAnimationFrame(() => {
      flyItemRef.current.style.transition = 'all 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
      flyItemRef.current.style.left = `${bagRect.left + bagRect.width / 2}px`;
      flyItemRef.current.style.top = `${bagRect.top + bagRect.height / 2}px`;
      flyItemRef.current.style.transform = 'scale(0.2)';
      flyItemRef.current.style.opacity = '0';
    });

    setTimeout(() => {
      bagIcon.style.transform = 'scale(1.3)';
      setTimeout(() => { bagIcon.style.transform = 'scale(1)'; }, 200);
      callback();
    }, 600);
  };

  const handleAddToCart = () => {
    if (!size) {
      setLowStockMsg('⚠ PLEASE SELECT A SIZE FIRST.');
      document.querySelector('.size-buttons')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (requiresColor && !color) {
      setLowStockMsg('PLEASE SELECT A COLOR FIRST.');
      document.querySelector('.color-buttons')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setLowStockMsg('');

    flyAnimation(() => {
      addToCart({
        productId: product.id,
        variantId: selectedVariant?.id,
        name: product.title,
        price: product.price,
        size,
        color,
        qty,
        img: product.images[0] || ''
      });
      setTimeout(() => openCart(), 300);
    });
  };

  const handleBuyNow = () => {
    if (!size) {
      setLowStockMsg('⚠ PLEASE SELECT A SIZE FIRST.');
      document.querySelector('.size-buttons')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (requiresColor && !color) {
      setLowStockMsg('PLEASE SELECT A COLOR FIRST.');
      document.querySelector('.color-buttons')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setLowStockMsg('');
    saveCheckout([{
      productId: product.id?.toString?.() || '',
      variantId: selectedVariant?.id || '',
      name: product.title,
      price: product.price,
      qty,
      size,
      color,
      img: product.images[0] || '',
    }], 'buy-now');
    router.push('/buynow?checkout=buy-now');
  };

  const toggleAccordion = (index) => {
    setOpenAccordion(openAccordion === index ? null : index);
  };

  return (
    <main className="product-page">
      <div className="gallery">
        <div className="gallery-main" id="galleryMain" ref={galleryMainRef} onScroll={handleScroll}>
          {product.images.length > 0 ? product.images.map((src, i) => (
            <img key={i} src={src} alt={`Image ${i + 1}`} />
          )) : (
            <div className="product-image-missing">NO IMAGE</div>
          )}
        </div>
        <div className="gallery-ui">
          <button className="gallery-arrow left" onClick={() => goToImage(currentIndex - 1)}>&#8592;</button>
          <div className="gallery-counter">{totalImages ? currentIndex + 1 : 0} / {totalImages}</div>
          <button className="gallery-arrow right" onClick={() => goToImage(currentIndex + 1)}>&#8594;</button>
        </div>
        <div className="gallery-thumbs" id="galleryThumbs">
          {product.images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`thumb ${i + 1}`}
              className={`thumb ${currentIndex === i ? 'active' : ''}`}
              onClick={() => goToImage(i)}
            />
          ))}
        </div>
      </div>

      <div className="product-info">
        <div className="product-title-wrap">
          <h1 className="product-title" id="productTitle">{product.title}</h1>
          <p className="product-price" id="productPrice">{product.priceLabel}</p>
        </div>

        <div className="option-group">
          <p className="option-label">SIZE</p>
          <div className="size-buttons">
            {['S', 'M', 'L', 'XL', 'XXL'].map(s => (
              <button
                key={s}
                className={`size-btn ${size === s ? 'active' : ''}`}
                onClick={() => availableSizes.includes(s) && setSize(s)}
                disabled={!availableSizes.includes(s)}
                style={!availableSizes.includes(s) ? { opacity: 0.25, cursor: 'not-allowed' } : {}}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {requiresColor && (
          <div className="option-group">
            <p className="option-label">COLOR</p>
            <div className="size-buttons color-buttons">
              {availableColors.map(c => (
                <button
                  key={c}
                  className={`size-btn color-btn ${color === c ? 'active' : ''}`}
                  onClick={() => setColor(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="option-group">
          <p className="option-label">QUANTITY</p>
          <div className="qty-wrap">
            <button className="qty-btn" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
            <span className="qty-display">{qty}</span>
            <button className="qty-btn" onClick={() => setQty(qty + 1)}>+</button>
          </div>
        </div>

        <p className={`low-stock ${showLowStockCount ? 'low-stock-alert' : ''}`} style={{ color: lowStockMsg ? '#ff4444' : '', opacity: lowStockMsg ? 1 : '' }}>
          {lowStockMsg || (showLowStockCount ? <>ONLY <span>{remainingStock}</span> LEFT</> : '| Low stock — Selling fast')}
        </p>

        <div className="cta-buttons">
          <button className="btn-cart" onClick={handleAddToCart}>ADD TO CART</button>
          <button className="btn-buy" onClick={handleBuyNow}>BUY IT NOW</button>
        </div>

        <div className="accordion">
          {[
            { title: 'PRODUCT DETAILS', content: <p>{product.description || 'NO PRODUCT DETAILS AVAILABLE.'}</p> },
            { title: 'SIZE CHART', content: <div className="size-chart-img"><img src="/assets/images/size-chart.png" alt="Size Chart" /></div> },
            { title: 'WASHING INSTRUCTIONS', content: <ul><li>WASH COLD 30°C MAX.</li><li>WASH INSIDE OUT.</li><li>DO NOT TUMBLE DRY.</li></ul> },
            { title: 'DELIVERY', content: <ul><li>ORDERS TAKE 2–3 BUSINESS DAYS.</li></ul> }
          ].map((item, i) => (
            <div className={`accordion-item ${openAccordion === i ? 'open' : ''}`} key={i}>
              <button className="accordion-trigger" onClick={() => toggleAccordion(i)}>
                <span>{item.title}</span>
                <ion-icon name="add-outline" className="acc-icon"></ion-icon>
              </button>
              <div className="accordion-body">
                {item.content}
              </div>
            </div>
          ))}
        </div>

        {!!(product.reviews && product.reviews.length) && (
        <div className="reviews-section">
          <h2 className="reviews-title">CUSTOMER REVIEWS</h2>
          <div className="reviews-track">
            {product.reviews.concat(product.reviews).map((rev, i) => (
              <div className="review-card" key={`${rev.id}-${i}`}>
                <div className="review-avatar">{(rev.name || '?').slice(0, 1).toUpperCase()}</div>
                <div className="review-body">
                  <p className="review-name">{rev.name}</p>
                  <p className="review-stars">★★★★★</p>
                  <p className="review-text">{rev.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>
      <div className="fly-item" id="flyItem" ref={flyItemRef}></div>
    </main>
  );
}
