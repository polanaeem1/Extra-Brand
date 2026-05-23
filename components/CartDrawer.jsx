'use client';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { saveCheckout } from '@/lib/checkout';

export default function CartDrawer() {
  const { cart, isOpen, closeCart, removeFromCart, totalPrice } = useCart();
  const router = useRouter();

  function handleCheckout() {
    if (cart.length === 0) return;
    saveCheckout(cart, 'cart');
    closeCart();
    router.push('/buynow?checkout=cart');
  }

  function handleContinue() {
    closeCart();
    const shopSection = document.getElementById('shop');
    if (shopSection) {
      setTimeout(() => shopSection.scrollIntoView({ behavior: 'smooth' }), 400);
    } else {
      router.push('/#shop');
    }
  }

  return (
    <>
      <div
        className={`cart-overlay${isOpen ? ' open' : ''}`}
        id="cartOverlay"
        onClick={closeCart}
      />
      <div className={`cart-drawer${isOpen ? ' open' : ''}`} id="cartDrawer">
        <div className="cart-header">
          <p className="cart-title">YOUR BAG</p>
          <ion-icon
            name="close-outline"
            className="cart-close"
            id="cartClose"
            onClick={closeCart}
          ></ion-icon>
        </div>

        {cart.length === 0 ? (
          <div className="cart-empty" id="cartEmpty" style={{ display: 'flex' }}>
            <ion-icon name="bag-outline" className="cart-empty-icon"></ion-icon>
            <p className="cart-empty-text">YOUR BAG IS EMPTY</p>
          </div>
        ) : (
          <>
            <div className="cart-items" id="cartItems">
              {cart.map((item, index) => (
                <div className="cart-item" key={index}>
                  <img src={item.img} alt={item.name} className="cart-item-img" />
                  <div className="cart-item-info">
                    <p className="cart-item-name">{item.name}</p>
                    <p className="cart-item-meta">
                      SIZE: {item.size}{item.color ? ` | COLOR: ${item.color}` : ''} &nbsp;|&nbsp; QTY: {item.qty}
                    </p>
                    <p className="cart-item-price">LE {(item.price * item.qty).toFixed(2)}</p>
                  </div>
                  <ion-icon
                    name="close-outline"
                    className="cart-item-remove"
                    onClick={() => removeFromCart(index)}
                  ></ion-icon>
                </div>
              ))}
            </div>

            <div className="cart-footer" id="cartFooter" style={{ display: 'flex' }}>
              <div className="cart-total-row">
                <p className="cart-total-label">TOTAL</p>
                <p className="cart-total-value" id="cartTotal">LE {totalPrice.toFixed(2)}</p>
              </div>
              <button className="cart-checkout-btn" id="cartCheckoutBtn" onClick={handleCheckout}>
                CHECKOUT ⟶
              </button>
              <button className="cart-continue-btn" id="cartContinueBtn" onClick={handleContinue}>
                CONTINUE SHOPPING
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
