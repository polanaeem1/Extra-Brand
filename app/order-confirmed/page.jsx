'use client';
import { useState } from 'react';
import Link from 'next/link';
import '@/styles/pages/order-confirmed.css';

export default function OrderConfirmedPage() {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText('EXTRA10').then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const shareText = encodeURIComponent(
    "Hey! 🖤 Just ordered from EXTRA — use my code EXTRA10 for 10% off your first order!\nhttps://your-website-link.com"
  );

  return (
    <main className="confirmed-main">
      <div className="confirmed-wrap">
        <div className="confirmed-icon-wrap">
          <ion-icon name="checkmark-outline" className="confirmed-icon"></ion-icon>
        </div>
        <p className="confirmed-label">✦ ORDER CONFIRMED ✦</p>
        <h1 className="confirmed-title">WELCOME<br/>TO THE<br/>FAMILY.</h1>
        <p className="confirmed-quote">You're not just a customer anymore.<br/>You're part of something extra.</p>
        
        <div className="confirmed-divider"></div>

        <div className="discount-box">
          <p className="discount-label">YOUR EXCLUSIVE DISCOUNT CODE</p>
          <div className="discount-code-wrap">
            <p className="discount-code" id="discountCode">EXTRA10</p>
            <ion-icon 
              name={isCopied ? "checkmark-outline" : "copy-outline"} 
              className="discount-copy" 
              onClick={handleCopy}
              style={isCopied ? { color: '#fff', opacity: 1 } : {}}
            ></ion-icon>
          </div>
          <p className="discount-note">10% off your next order — share it with someone you love.</p>
        </div>

        <div className="confirmed-divider"></div>

        <a className="whatsapp-share" href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noreferrer">
          <ion-icon name="logo-whatsapp"></ion-icon>
          SHARE YOUR CODE WITH A FRIEND
        </a>

        <Link href="/" className="back-home">BACK TO HOME</Link>
        <Link href="/#shop" className="shop-more">SHOP MORE ⟶</Link>
      </div>
    </main>
  );
}
