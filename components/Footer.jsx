'use client';
import Link from 'next/link';

const socialLinks = [
  {
    href: 'https://www.instagram.com/extra.styling?igsh=emplOWhiaGFvcnlt',
    icon: 'logo-instagram',
    label: 'Instagram',
  },
  {
    // TODO: replace with your official Facebook page URL.
    href: 'https://www.facebook.com/share/1JgCRRXgoS/?mibextid=wwXIfr',
    icon: 'logo-facebook',
    label: 'Facebook',
  },
  {
    href: 'https://www.tiktok.com/@extra.styling?_r=1&_t=ZS-96QITrolAuK',
    icon: 'logo-tiktok',
    label: 'TikTok',
  },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-img">
        <img src="/assets/images/Footer.jpeg" alt="EXTRA" />
      </div>
      <div className="footer-top">
        <div className="footer-col">
          <p className="footer-label">LINKS</p>
          <ul className="footer-links">
            <li><a href="/#top">Home</a></li>
            <li><a href="/#shop">Shop All</a></li>
            <li><Link href="/contact">Contact Us</Link></li>
            <li><Link href="/policies">Policies</Link></li>
          </ul>
        </div>
        <div className="footer-col">
          <p className="footer-label">FOLLOW US</p>
          <div className="footer-socials">
            {socialLinks.map((link) => (
              <a key={link.icon} href={link.href} target="_blank" rel="noreferrer" aria-label={link.label}>
                <ion-icon name={link.icon}></ion-icon>
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© 2026 EXTRA. ALL RIGHTS RESERVED.</p>
      </div>
    </footer>
  );
}
