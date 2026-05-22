import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function cleanText(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : fallback;
}

function sourceFromReferrer(referrer: string) {
  if (!referrer) return 'Direct';

  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
    if (host.includes('instagram')) return 'Instagram';
    if (host.includes('tiktok')) return 'TikTok';
    if (host.includes('facebook')) return 'Facebook';
    if (host.includes('google') || host.includes('bing') || host.includes('yahoo')) return 'Search';
    return host;
  } catch {
    return 'Referral';
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));

  const path = cleanText(body.path, '/');
  const referrer = cleanText(body.referrer);
  const visitorId = cleanText(body.visitorId);
  const source = cleanText(body.source, sourceFromReferrer(referrer));
  const userAgent = cleanText(request.headers.get('user-agent'));

  if (path.startsWith('/admin')) {
    return NextResponse.json({ tracked: false });
  }

  const { error } = await supabase.from('page_views').insert({
    path,
    source,
    referrer,
    visitor_id: visitorId,
    user_agent: userAgent,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ tracked: true });
}
