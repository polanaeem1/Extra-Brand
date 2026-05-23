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
        



        <Link href="/" className="back-home">BACK TO HOME</Link>
        <Link href="/#shop" className="shop-more">SHOP MORE ⟶</Link>
      </div>
    </main>
  );
}
