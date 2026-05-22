'use client';
import Link from 'next/link';
import '@/styles/pages/welcome.css';

export default function WelcomePage() {
  return (
    <main className="welcome-page">
      <div className="welcome-wrap">
        <div className="welcome-icon">✦</div>
        <div className="welcome-text">
          <p className="welcome-label">YOU'RE NOW PART OF</p>
          <h1 className="welcome-title">THE EXTRA<br/>FAMILY</h1>
          <p className="welcome-sub">ALWAYS EXTRA.. NEVER BASIC.</p>
        </div>
        <Link href="/#shop" className="welcome-btn">START SHOPPING ⟶</Link>
      </div>
    </main>
  );
}
