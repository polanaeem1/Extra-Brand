'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAside } from '@/context/AsideContext';
import { useCart } from '@/context/CartContext';
import { createClient } from '@/lib/supabase/browser';
import { signOutOnce, subscribeAuthState } from '@/lib/supabase/authState';

export default function Navbar() {
  const { openAside } = useAside();
  const { totalItems, openCart } = useCart();
  const navRef = useRef(null);
  const profileRef = useRef(null);
  const [userEmail, setUserEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const handleScroll = () => {
      if (!navRef.current) return;
      navRef.current.style.background =
        window.scrollY > 40 ? 'rgba(0,0,0,0.97)' : 'rgba(0,0,0,0.88)';
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let profileRequestId = 0;

    const refreshIdentity = async (session) => {
      const requestId = ++profileRequestId;
      const user = session?.user || null;
      if (!isMounted) return;

      setUserEmail(user?.email || '');
      setIsAdmin(false);

      if (!user?.id) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role,status')
        .eq('id', user.id)
        .maybeSingle();

      if (!isMounted || requestId !== profileRequestId) return;
      setIsAdmin(profile?.role === 'admin' && profile?.status !== 'banned');
    };

    const unsubscribe = subscribeAuthState((session) => {
      refreshIdentity(session);
      setIsProfileOpen(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOutOnce();
    setUserEmail('');
    setIsAdmin(false);
    setIsProfileOpen(false);
    window.location.href = '/';
  };

  return (
    <nav className="navbar" ref={navRef}>
      <div className="menu-icon" id="menuIcon" onClick={openAside}>
        <ion-icon name="menu-outline"></ion-icon>
      </div>
      <Link href="/">
        <div className="logo-video-wrapper">
          <video autoPlay muted loop playsInline className="logo-video">
            <source src="/assets/Videos/ComfyUI_00003_.mp4" type="video/mp4" />
          </video>
        </div>
      </Link>
      <div className="nav-icons">
        <div ref={profileRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {userEmail ? (
            <>
              <button
                type="button"
                onClick={() => setIsProfileOpen((value) => !value)}
                aria-label="Open profile menu"
                style={{
                  background: 'transparent',
                  border: 0,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <ion-icon name="person-circle-outline"></ion-icon>
              </button>
              {isProfileOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 18px)',
                    right: 0,
                    width: 220,
                    background: '#050505',
                    border: '1px solid rgba(255,255,255,0.12)',
                    padding: 14,
                    zIndex: 3000,
                    boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
                  }}
                >
                  <p style={{
                    color: 'rgba(255,255,255,0.45)',
                    fontSize: 9,
                    fontFamily: 'Syncopate, sans-serif',
                    letterSpacing: '0.22em',
                    marginBottom: 8,
                  }}>
                    SIGNED IN
                  </p>
                  <p style={{
                    color: '#fff',
                    fontSize: 12,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: 12,
                  }}>
                    {userEmail}
                  </p>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        window.location.href = '/admin';
                      }}
                      style={{
                        width: '100%',
                        border: '1px solid rgba(255,255,255,0.14)',
                        background: 'transparent',
                        color: '#fff',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        fontFamily: 'Syncopate, sans-serif',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.18em',
                        marginBottom: 10,
                      }}
                    >
                      DASHBOARD
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      border: '1px solid rgba(255,255,255,0.14)',
                      background: 'rgba(255,255,255,0.06)',
                      color: '#fff',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      fontFamily: 'Syncopate, sans-serif',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                    }}
                  >
                    LOG OUT
                  </button>
                </div>
              )}
            </>
          ) : (
            <Link href="/login" style={{ display: 'flex', alignItems: 'center' }} aria-label="Login">
              <ion-icon name="person-outline"></ion-icon>
            </Link>
          )}
        </div>
        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={openCart}>
          <ion-icon name="bag-outline"></ion-icon>
          {totalItems > 0 && (
            <span className="bag-badge show">{totalItems}</span>
          )}
        </div>
      </div>
    </nav>
  );
}
