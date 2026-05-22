'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { clearCheckout, loadCheckout, normalizeCheckoutItem } from '@/lib/checkout';
import '@/styles/pages/buynow.css';

function BuyNowContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clearCart } = useCart();
  const [checkoutItems, setCheckoutItems] = useState([]);
  const [checkoutSource, setCheckoutSource] = useState('buy-now');
  const [shipping, setShipping] = useState(0);
  const [city, setCity] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [screenshot, setScreenshot] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });

  useEffect(() => {
    const stored = loadCheckout();
    if (stored?.items?.length) {
      setCheckoutItems(stored.items.map(normalizeCheckoutItem));
      setCheckoutSource(stored.source || 'buy-now');
      return;
    }

    const qty = Number(searchParams.get('qty') || 1);
    const total = Number(searchParams.get('total') || 0);
    const fallbackItem = normalizeCheckoutItem({
      productId: searchParams.get('productId') || '',
      variantId: searchParams.get('variantId') || '',
      name: searchParams.get('name') || '',
      size: searchParams.get('size') || '',
      qty,
      price: qty > 0 ? total / qty : 0,
    });

    if (fallbackItem.name) {
      setCheckoutItems([fallbackItem]);
      setCheckoutSource('buy-now');
    }
  }, [searchParams]);

  const subtotal = useMemo(
    () => checkoutItems.reduce((sum, item) => sum + item.price * item.qty, 0),
    [checkoutItems]
  );
  const totalItems = useMemo(
    () => checkoutItems.reduce((sum, item) => sum + item.qty, 0),
    [checkoutItems]
  );
  const total = subtotal + shipping;
  const isTransfer = paymentMethod === 'Instapay' || paymentMethod === 'Vodafone';

  const handleCopy = () => {
    navigator.clipboard.writeText('01001970249').then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleConfirm = async () => {
    const { fullName, phone, email, address } = formData;
    if (!checkoutItems.length) {
      setErrorMsg('YOUR CHECKOUT IS EMPTY.');
      return;
    }
    if (!fullName || !phone || !email || !address || !shipping) {
      setErrorMsg('PLEASE FILL IN ALL REQUIRED FIELDS.');
      document.querySelector('.shipping-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (!email.includes('@')) {
      setErrorMsg('PLEASE ENTER A VALID EMAIL.');
      return;
    }
    if (phone.length < 10) {
      setErrorMsg('PLEASE ENTER A VALID PHONE NUMBER.');
      return;
    }
    if (isTransfer && !screenshot) {
      setErrorMsg('PLEASE UPLOAD YOUR PAYMENT SCREENSHOT.');
      document.getElementById('transferInfo')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);

    const orderData = new FormData();
    orderData.append('items', JSON.stringify(checkoutItems.map((item) => ({
      product_id: item.productId,
      variant_id: item.variantId,
      product_name: item.name,
      size: item.size,
      quantity: item.qty,
      unit_price: item.price.toFixed(2),
      line_total: (item.price * item.qty).toFixed(2),
    }))));
    orderData.append('subtotal', subtotal.toFixed(2));
    orderData.append('shippingFee', shipping.toFixed(2));
    orderData.append('total', total.toFixed(2));
    orderData.append('paymentMethod', paymentMethod);
    orderData.append('city', city);
    orderData.append('fullName', formData.fullName);
    orderData.append('phone', formData.phone);
    orderData.append('email', formData.email);
    orderData.append('address', formData.address);
    orderData.append('notes', formData.notes);
    if (screenshot) orderData.append('receipt', screenshot);

    const response = await fetch('/api/orders', {
      method: 'POST',
      body: orderData,
    });
    const result = await response.json();

    if (!response.ok) {
      setIsSubmitting(false);
      setErrorMsg(result.error || 'ORDER COULD NOT BE CREATED.');
      return;
    }

    clearCheckout();
    if (checkoutSource === 'cart') {
      clearCart();
    }

    router.push(`/order-confirmed?order=${result.order?.order_number || result.order?.id || ''}`);
  };

  if (checkoutItems.length === 0) {
    return (
      <main className="buynow-page">
        <div className="buynow-wrap">
          <div className="section-block">
            <p className="section-label">CHECKOUT</p>
            <h1 className="section-title">YOUR ORDER IS EMPTY</h1>
          </div>
          <p className="form-error" style={{ display: 'block', marginBottom: 24 }}>Choose a product before opening checkout.</p>
          <button className="confirm-btn" onClick={() => router.push('/#shop')}>GO TO SHOP</button>
        </div>
      </main>
    );
  }

  return (
    <main className="buynow-page">
      <div className="buynow-wrap">
        <div className="section-block">
          <p className="section-label">CONFIRM ORDER</p>
          <h1 className="section-title">BUY IT NOW</h1>
        </div>

        <div className="order-summary">
          <div className="order-product">
            <p className="order-name">{checkoutItems.length === 1 ? checkoutItems[0].name : `${totalItems} ITEMS IN YOUR ORDER`}</p>
            <p className="order-price">LE {subtotal.toFixed(2)}</p>
          </div>
          <div className="order-divider"></div>
          {checkoutItems.map((item, index) => (
            <div key={`${item.name}-${item.size}-${index}`} className="order-row">
              <p className="order-label">{item.name} / {item.size}</p>
              <p className="order-value">{item.qty} x LE {item.price.toFixed(2)}</p>
            </div>
          ))}
          <div className="order-divider"></div>
          <div className="order-row">
            <p className="order-label">SUBTOTAL</p>
            <p className="order-value">LE {subtotal.toFixed(2)}</p>
          </div>
          <div className="order-row">
            <p className="order-label">SHIPPING</p>
            <p className="order-value">{shipping ? `LE ${shipping.toFixed(2)}` : '- SELECT CITY -'}</p>
          </div>
          <div className="order-divider"></div>
          <div className="order-row grand-total">
            <p className="order-label">TOTAL</p>
            <p className="order-value">{shipping ? `LE ${total.toFixed(2)}` : '-'}</p>
          </div>
        </div>

        <div className="section-block">
          <p className="section-label">SHIPPING DETAILS</p>
          <h2 className="section-title-sm">DELIVERY INFO</h2>
        </div>

        <div className="shipping-form">
          <div className="form-group">
            <label className="form-label">NAME</label>
            <input type="text" className="form-input" placeholder="YOUR FULL NAME" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">PHONE NUMBER</label>
            <input type="tel" className="form-input" placeholder="01X XXXX XXXX" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">EMAIL</label>
            <input type="email" className="form-input" placeholder="YOUR EMAIL" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">ADDRESS</label>
            <input type="text" className="form-input" placeholder="STREET, BUILDING, FLOOR" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">CITY</label>
            <select className="form-input form-select" onChange={e => {
              setShipping(parseInt(e.target.value, 10) || 0);
              setCity(e.target.selectedOptions[0]?.textContent || '');
            }}>
              <option value="">SELECT YOUR CITY</option>
              <optgroup label="ZONE A - LE 75">
                <option value="75">CAIRO</option><option value="75">GIZA</option><option value="75">ALEXANDRIA</option>
              </optgroup>
              <optgroup label="ZONE B - LE 85">
                <option value="85">DAKAHLIA</option><option value="85">GHARBIA</option>
              </optgroup>
              <optgroup label="ZONE C - LE 100">
                <option value="100">ASSIUT</option><option value="100">SOHAG</option>
              </optgroup>
              <optgroup label="ZONE D - LE 110">
                <option value="110">MATROUH</option>
              </optgroup>
            </select>
          </div>
        </div>

        <div className="section-block">
          <p className="section-label">PAYMENT</p>
          <h2 className="section-title-sm">PAYMENT METHOD</h2>
        </div>

        <div className="payment-options">
          <div className={`payment-option ${paymentMethod === 'COD' ? 'active' : ''}`} onClick={() => setPaymentMethod('COD')}>
            <div className="payment-radio"></div>
            <div className="payment-text">
              <p className="payment-name">CASH ON DELIVERY</p>
              <p className="payment-sub">PAY WHEN YOU RECEIVE YOUR ORDER</p>
            </div>
            <ion-icon name="cash-outline" className="payment-icon"></ion-icon>
          </div>
          <div className={`payment-option ${paymentMethod === 'Instapay' ? 'active' : ''}`} onClick={() => setPaymentMethod('Instapay')}>
            <div className="payment-radio"></div>
            <div className="payment-text">
              <p className="payment-name">INSTAPAY</p>
              <p className="payment-sub">TRANSFER BEFORE SHIPPING</p>
            </div>
            <ion-icon name="phone-portrait-outline" className="payment-icon"></ion-icon>
          </div>
          <div className={`payment-option ${paymentMethod === 'Vodafone' ? 'active' : ''}`} onClick={() => setPaymentMethod('Vodafone')}>
            <div className="payment-radio"></div>
            <div className="payment-text">
              <p className="payment-name">VODAFONE CASH</p>
              <p className="payment-sub">TRANSFER BEFORE SHIPPING</p>
            </div>
            <ion-icon name="wallet-outline" className="payment-icon vodafone-icon"></ion-icon>
          </div>
        </div>

        <div className={`transfer-info ${isTransfer ? 'show' : ''}`} id="transferInfo">
          <p className="transfer-label">SEND TO</p>
          <p className="transfer-method">{paymentMethod === 'Vodafone' ? 'VODAFONE CASH' : 'INSTAPAY'}</p>
          <div className="transfer-number-wrap">
            <p className="transfer-number">01001970249</p>
            <ion-icon name={isCopied ? 'checkmark-outline' : 'copy-outline'} className="copy-icon" onClick={handleCopy} title="Copy" style={isCopied ? { color: '#fff', opacity: 1 } : {}}></ion-icon>
          </div>
          <p className="transfer-note">UPLOAD SCREENSHOT AFTER TRANSFER</p>
          <div className="upload-wrap">
            <input type="file" id="screenshotUpload" accept="image/*" className="upload-input" onChange={e => setScreenshot(e.target.files?.[0] || null)} />
            <label htmlFor="screenshotUpload" className={`upload-btn ${screenshot ? 'uploaded' : ''}`}>
              <ion-icon name="cloud-upload-outline"></ion-icon>
              <span>{screenshot ? 'SCREENSHOT UPLOADED' : 'UPLOAD SCREENSHOT'}</span>
            </label>
            <p className="upload-preview">{screenshot?.name}</p>
          </div>
        </div>

        <p className="form-error">{errorMsg}</p>

        <button className="confirm-btn" onClick={handleConfirm} disabled={isSubmitting} style={isSubmitting ? { opacity: 0.7 } : {}}>
          {isSubmitting ? 'PLACING ORDER...' : 'COMPLETE ORDER'}
        </button>
        <button className="back-link" onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: '20px' }}>BACK TO SHOPPING</button>
        <p className="delivery-note">FREE DELIVERY ON ORDERS ABOVE LE 1,500</p>
      </div>
    </main>
  );
}

export default function BuyNowPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BuyNowContent />
    </Suspense>
  );
}
