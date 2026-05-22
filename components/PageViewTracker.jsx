'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function getVisitorId() {
  const key = 'extra_visitor_id';
  let visitorId = localStorage.getItem(key);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem(key, visitorId);
  }
  return visitorId;
}

function getSource() {
  const searchParams = new URLSearchParams(window.location.search);
  const utmSource = searchParams.get('utm_source');
  if (utmSource) return utmSource;
  return '';
}

export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return;

    fetch('/api/page-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: `${pathname}${window.location.search}`,
        referrer: document.referrer,
        source: getSource(),
        visitorId: getVisitorId(),
      }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
