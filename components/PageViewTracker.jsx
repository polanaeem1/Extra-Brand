'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getVisitorId } from '@/lib/analytics/visitor';
import { logSupabaseRequest } from '@/lib/supabase/debug';

function normalizeTrafficSource(input) {
  const value = (input || '').trim().toLowerCase();
  if (!value) return '';
  if (value === 'google') return 'Google';
  if (value === 'facebook' || value === 'fb') return 'Facebook';
  if (value === 'instagram' || value === 'ig') return 'Instagram';
  if (value === 'tiktok' || value === 'tt') return 'TikTok';
  if (value === 'direct') return 'Direct';
  return '';
}

function trafficSourceFromReferrer(referrer) {
  if (!referrer) return 'Direct';
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
    if (host.includes('google') || host.includes('bing') || host.includes('yahoo')) return 'Google';
    if (host.includes('facebook') || host.includes('fb.')) return 'Facebook';
    if (host.includes('instagram')) return 'Instagram';
    if (host.includes('tiktok')) return 'TikTok';
    return 'Other';
  } catch {
    return 'Other';
  }
}

function getAttribution() {
  const key = 'extra_attribution_v1';
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    stored = null;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const utm_source = searchParams.get('utm_source') || stored?.utm_source || '';
  const utm_medium = searchParams.get('utm_medium') || stored?.utm_medium || '';
  const utm_campaign = searchParams.get('utm_campaign') || stored?.utm_campaign || '';

  const traffic_source =
    normalizeTrafficSource(searchParams.get('utm_source')) ||
    stored?.traffic_source ||
    trafficSourceFromReferrer(document.referrer);

  const next = { utm_source, utm_medium, utm_campaign, traffic_source, updated_at: Date.now() };
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

function shouldSendVisit(pathname) {
  const dateKey = new Date().toLocaleDateString('en-CA'); // local timezone (e.g. Cairo)
  const key = `extra_visit_sent_${dateKey}:${pathname}`;
  try {
    if (sessionStorage.getItem(key) || localStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
    localStorage.setItem(key, '1');
  } catch {
    // sessionStorage might be blocked; fall back to "send"
  }
  return true;
}

function sendVisit(payload) {
  logSupabaseRequest('analytics.visit', payload.page_path);
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/visit', blob);
      return;
    }
  } catch {
    // ignore
  }

  fetch('/api/analytics/visit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return;
    if (!shouldSendVisit(pathname)) return;

    const attribution = getAttribution();
    sendVisit({
      page_path: pathname,
      referrer: document.referrer,
      traffic_source: attribution.traffic_source,
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      visitor_id: getVisitorId(),
    });
  }, [pathname]);

  return null;
}
