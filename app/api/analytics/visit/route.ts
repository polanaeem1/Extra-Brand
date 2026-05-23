import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function cleanText(value: unknown, fallback = '', maxLen = 500) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLen) : fallback;
}

function trafficSourceFromReferrer(referrer: string) {
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

function normalizeTrafficSource(input: string) {
  const value = (input || '').trim().toLowerCase();
  if (!value) return '';
  if (value === 'google') return 'Google';
  if (value === 'facebook' || value === 'fb') return 'Facebook';
  if (value === 'instagram' || value === 'ig') return 'Instagram';
  if (value === 'tiktok' || value === 'tt') return 'TikTok';
  if (value === 'direct') return 'Direct';
  return '';
}

function cairoDateString(date = new Date()) {
  // Business reporting is typically local-time based; use Africa/Cairo for daily buckets.
  // Returns YYYY-MM-DD.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value || '1970';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const d = parts.find((p) => p.type === 'day')?.value || '01';
  return `${y}-${m}-${d}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));

  const pagePath = cleanText(body.page_path ?? body.path, '/', 2048);
  if (!pagePath || pagePath.startsWith('/admin')) {
    return NextResponse.json({ tracked: false });
  }

  const referrer = cleanText(body.referrer);
  const visitorId = cleanText(body.visitor_id ?? body.visitorId, '', 128);
  const utmSource = cleanText(body.utm_source ?? body.utmSource, '', 128);
  const utmMedium = cleanText(body.utm_medium ?? body.utmMedium, '', 128);
  const utmCampaign = cleanText(body.utm_campaign ?? body.utmCampaign, '', 128);
  const providedTrafficSource = cleanText(body.traffic_source ?? body.trafficSource, '', 64);

  const trafficSource =
    normalizeTrafficSource(providedTrafficSource) ||
    normalizeTrafficSource(utmSource) ||
    trafficSourceFromReferrer(referrer);

  if (!visitorId) {
    return NextResponse.json({ tracked: false });
  }

  const { error } = await supabase.from('analytics_visits').insert({
    visitor_id: visitorId,
    page_path: pagePath,
    visit_date: cairoDateString(),
    referrer,
    traffic_source: trafficSource || 'Other',
    utm_source: utmSource || null,
    utm_medium: utmMedium || null,
    utm_campaign: utmCampaign || null,
    user_id: null,
  });

  // When the optional dedupe unique index is enabled, repeat visits can cause a 23505 unique violation.
  // Treat that as "tracked".
  if (error) {
    if (error.code === '23505') return NextResponse.json({ tracked: true, deduped: true });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ tracked: true });
}
