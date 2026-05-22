'use client';
import '@/styles/pages/policies.css';

export default function PoliciesPage() {
  return (
    <main className="policies-main">
      <div className="policies-hero">
        <p className="policies-label">✦ EXTRA ✦</p>
        <h1 className="policies-title">POLICIES</h1>
        <div className="policies-line"></div>
      </div>

      <div className="policies-content">
        <div className="policy-block">
          <p className="policy-number">01</p>
          <div className="policy-body">
            <h2 className="policy-heading">RETURNS & EXCHANGES</h2>
            <p className="policy-text">You have 14 days from delivery to request a return or exchange.</p>
            <p className="policy-text">Feel free to try the item while the courier is at your door. If there's an issue, simply return it on the spot — you'll only be responsible for the delivery fees.</p>
          </div>
        </div>

        <div className="policy-divider"></div>

        <div className="policy-block">
          <p className="policy-number">02</p>
          <div className="policy-body">
            <h2 className="policy-heading">SHIPPING</h2>
            <p className="policy-text">Once your order is on its way, we'll reach out on WhatsApp and confirm everything together.</p>
          </div>
        </div>

        <div className="policy-divider"></div>

        <div className="policy-block">
          <p className="policy-number">03</p>
          <div className="policy-body">
            <h2 className="policy-heading">ANY QUESTIONS?</h2>
            <p className="policy-text">We're always here. Just message us on WhatsApp — we're not just a brand, we're family. 🤍</p>
            <a href="https://wa.me/201001970249" target="_blank" rel="noreferrer" className="policy-whatsapp">
              <ion-icon name="logo-whatsapp"></ion-icon>
              MESSAGE US⟶
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
