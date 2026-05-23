'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { getVisitorId } from '@/lib/analytics/visitor';
import '@/styles/pages/contact.css';

const socialCards = [
  {
    href: 'https://www.instagram.com/extra.styling?igsh=emplOWhiaGFvcnlt',
    icon: 'logo-instagram',
    name: 'INSTAGRAM',
    handle: '@extra.styling',
  },
  {
    // TODO: replace with your official Facebook page URL.
    href: 'https://www.facebook.com/',
    icon: 'logo-facebook',
    name: 'FACEBOOK',
    handle: 'EXTRA STYLING',
  },
  {
    href: 'https://www.tiktok.com/@extra.styling?_r=1&_t=ZS-96QITrolAuK',
    icon: 'logo-tiktok',
    name: 'TIKTOK',
    handle: '@extra.styling',
  },
];

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [btnText, setBtnText] = useState('SEND MESSAGE >');
  const [btnState, setBtnState] = useState('default'); // default, error, success

  const handleSubmit = async () => {
    const { name, email, message } = formData;

    if (!name || !email || !message) {
      setBtnText('PLEASE FILL ALL FIELDS');
      setBtnState('error');
      setTimeout(() => {
        setBtnText('SEND MESSAGE >');
        setBtnState('default');
      }, 2000);
      return;
    }

    if (!email.includes('@')) {
      setBtnText('PLEASE ENTER A VALID EMAIL');
      setBtnState('error');
      setTimeout(() => {
        setBtnText('SEND MESSAGE >');
        setBtnState('default');
      }, 2000);
      return;
    }

    setBtnText('SENDING...');
    setBtnState('default');

    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();

      const { error } = await supabase.from('contact_messages').insert({
        visitor_id: getVisitorId(),
        user_id: sessionData?.session?.user?.id || null,
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
      });

      if (error) {
        setBtnText('MESSAGE FAILED');
        setBtnState('error');
        setTimeout(() => {
          setBtnText('SEND MESSAGE >');
          setBtnState('default');
        }, 2500);
        return;
      }

      setBtnText('MESSAGE SENT');
      setBtnState('success');
      setFormData({ name: '', email: '', message: '' });
      setTimeout(() => {
        setBtnText('SEND MESSAGE >');
        setBtnState('default');
      }, 3000);
    } catch {
      setBtnText('MESSAGE FAILED');
      setBtnState('error');
      setTimeout(() => {
        setBtnText('SEND MESSAGE >');
        setBtnState('default');
      }, 2500);
    }
  };

  return (
    <main className="contact-page">
      <div className="contact-header">
        <p className="contact-label">GET IN TOUCH</p>
        <h1 className="contact-title">CONTACT US</h1>
        <p className="contact-sub">WE'D LOVE TO HEAR FROM YOU.</p>
      </div>

      <div className="contact-form-wrap">
        <div className="form-group">
          <label className="form-label">NAME</label>
          <input
            type="text"
            className="form-input"
            placeholder="YOUR NAME"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">EMAIL</label>
          <input
            type="email"
            className="form-input"
            placeholder="YOUR EMAIL"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">MESSAGE</label>
          <textarea
            className="form-input form-textarea"
            placeholder="YOUR MESSAGE"
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          ></textarea>
        </div>
        <button
          className="form-submit"
          onClick={handleSubmit}
          style={
            btnState !== 'default'
              ? {
                  background: 'transparent',
                  color: 'var(--silver)',
                  borderColor: 'rgba(207,207,207,0.5)',
                }
              : {}
          }
        >
          {btnText}
        </button>
      </div>

      <div className="contact-divider">
        <span>OR REACH US ON</span>
      </div>

      <div className="contact-socials">
        {socialCards.map((card) => (
          <a key={card.icon} href={card.href} target="_blank" rel="noreferrer" className="social-card">
            <ion-icon name={card.icon}></ion-icon>
            <div className="social-info">
              <p className="social-name">{card.name}</p>
              <p className="social-handle">{card.handle}</p>
            </div>
            <ion-icon name="arrow-forward-outline" className="social-arrow"></ion-icon>
          </a>
        ))}
      </div>
    </main>
  );
}
