import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function required(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const supabase = await createClient();

  const customerName = required(formData.get('fullName'));
  const email = required(formData.get('email'));
  const phone = required(formData.get('phone'));
  const address = required(formData.get('address'));
  const city = required(formData.get('city'));
  const paymentMethod = required(formData.get('paymentMethod')) || 'COD';
  const shippingFee = Number(required(formData.get('shippingFee')) || 0);
  const subtotal = Number(required(formData.get('subtotal')) || 0);
  const total = Number(required(formData.get('total')) || subtotal + shippingFee);
  const itemsRaw = required(formData.get('items'));
  const visitorId = required(formData.get('visitorId'));
  const promoCode = required(formData.get('promoCode'));

  let itemsPayload: any[] = [];
  try {
    itemsPayload = JSON.parse(itemsRaw);
  } catch {
    return NextResponse.json({ error: 'Invalid order items.' }, { status: 400 });
  }

  const normalizedItems = itemsPayload
    .filter((item) => item && item.product_name && item.size)
    .map((item) => ({
      product_id: typeof item.product_id === 'string' ? item.product_id : '',
      variant_id: typeof item.variant_id === 'string' ? item.variant_id : '',
      product_name: String(item.product_name),
      size: String(item.size),
      color: typeof item.color === 'string' ? item.color : '',
      quantity: Number(item.quantity || 1),
      unit_price: Number(item.unit_price || 0),
      line_total: Number(item.line_total || 0),
    }));

  if (!customerName || !email || !phone || !address || !city || normalizedItems.length === 0) {
    return NextResponse.json({ error: 'Missing required order fields.' }, { status: 400 });
  }

  if (!visitorId) {
    return NextResponse.json({ error: 'Missing visitor id.' }, { status: 400 });
  }

  if (!['COD', 'Instapay', 'Vodafone'].includes(paymentMethod)) {
    return NextResponse.json({ error: 'Invalid payment method.' }, { status: 400 });
  }

  let receiptUrl = '';
  const receipt = formData.get('receipt');

  if (paymentMethod !== 'COD') {
    if (!(receipt instanceof File) || receipt.size === 0) {
      return NextResponse.json({ error: 'Payment screenshot is required.' }, { status: 400 });
    }

    const extension = receipt.name.split('.').pop() || 'jpg';
    const receiptPath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('payment-receipts')
      .upload(receiptPath, receipt, {
        contentType: receipt.type || 'image/jpeg',
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }

    receiptUrl = receiptPath;
  }

  const { data, error } = await supabase.rpc('create_order_with_items', {
    order_payload: {
      visitor_id: visitorId,
      promo_code: promoCode,
      customer_name: customerName,
      email,
      phone,
      address,
      city,
      notes: required(formData.get('notes')),
      shipping_fee: shippingFee,
      subtotal,
      total,
      payment_method: paymentMethod,
      payment_status: paymentMethod === 'COD' ? 'pending' : 'paid',
      receipt_url: receiptUrl,
    },
    items_payload: normalizedItems,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ order: data });
}
