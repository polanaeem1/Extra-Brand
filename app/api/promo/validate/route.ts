import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function cleanCode(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 64) : '';
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));

  const code = cleanCode(body.code);
  const subtotal = Number(body.subtotal || 0);

  if (!code) {
    return NextResponse.json({ ok: false, reason: 'missing' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('validate_promo_code', {
    p_code: code,
    p_subtotal: subtotal,
  });

  if (error) {
    return NextResponse.json({ ok: false, reason: 'error', error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

