'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/browser';
import { getCurrentAdmin } from '@/lib/supabase/admin';
import '@/styles/pages/register.css';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '', password: '', confirm: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { isAdmin } = await getCurrentAdmin();
      router.replace(isAdmin ? '/admin' : '/');
    });
  }, [router]);

  const handleRegister = async () => {
    const { firstName, lastName, email, phone, password, confirm } = formData;
    if (!firstName || !lastName || !email || !phone || !password || !confirm) {
      setErrorMsg('PLEASE FILL IN ALL FIELDS.');
      return;
    }
    if (!email.includes('@')) {
      setErrorMsg('PLEASE ENTER A VALID EMAIL.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('PASSWORD MUST BE AT LEAST 6 CHARACTERS.');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('PASSWORDS DO NOT MATCH.');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);

    const supabase = createClient();
    const emailRedirectTo = (() => {
      try {
        // Use the current origin to avoid Supabase "redirect URL not allowed" issues
        // when developing on different devices/hosts (localhost vs 127.0.0.1 vs LAN IP).
        return `${window.location.origin}/welcome`;
      } catch {
        return undefined;
      }
    })();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
        data: {
          first_name: firstName,
          last_name: lastName,
          phone,
        },
      },
    });

    if (error) {
      setErrorMsg(error.message.toUpperCase());
      setIsSubmitting(false);
      return;
    }

    if (data.user) {
      await supabase.from('profiles').upsert(
        {
          id: data.user.id,
          email,
          first_name: firstName,
          last_name: lastName,
          phone,
          role: 'customer',
          status: 'active',
        },
        { onConflict: 'id' }
      );
    }

    router.refresh();
    router.push('/welcome');
  };

  return (
    <main className="register-page">
      <div className="register-wrap">
        <div className="register-header">
          <p className="register-label">✦ JOIN THE EXTRA FAMILY ✦</p>
          <h1 className="register-title">CREATE ACCOUNT</h1>
        </div>
        <div className="register-form">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">FIRST NAME</label>
              <input type="text" className="form-input" placeholder="FIRST NAME" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">LAST NAME</label>
              <input type="text" className="form-input" placeholder="LAST NAME" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">EMAIL</label>
            <input type="email" className="form-input" placeholder="YOUR EMAIL" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">PHONE NUMBER</label>
            <input type="tel" className="form-input" placeholder="YOUR PHONE NUMBER" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">PASSWORD</label>
            <div className="input-wrap">
              <input type={showPassword ? "text" : "password"} className="form-input" placeholder="CREATE PASSWORD" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              <ion-icon name={showPassword ? "eye-outline" : "eye-off-outline"} className="eye-icon" onClick={() => setShowPassword(!showPassword)} style={{ opacity: showPassword ? 1 : 0.4 }}></ion-icon>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">CONFIRM PASSWORD</label>
            <div className="input-wrap">
              <input type={showConfirm ? "text" : "password"} className="form-input" placeholder="CONFIRM PASSWORD" value={formData.confirm} onChange={e => setFormData({...formData, confirm: e.target.value})} />
              <ion-icon name={showConfirm ? "eye-outline" : "eye-off-outline"} className="eye-icon" onClick={() => setShowConfirm(!showConfirm)} style={{ opacity: showConfirm ? 1 : 0.4 }}></ion-icon>
            </div>
          </div>
          <p className="form-error">{errorMsg}</p>
          <button className="register-btn" onClick={handleRegister} disabled={isSubmitting} style={{ opacity: isSubmitting ? 0.7 : 1 }}>
            {isSubmitting ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT ⟶'}
          </button>
          <p className="register-footer">
            ALREADY HAVE AN ACCOUNT? <Link href="/login">LOGIN</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
