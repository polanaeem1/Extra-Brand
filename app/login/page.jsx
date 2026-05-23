'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/browser';
import { getCurrentAdmin } from '@/lib/supabase/admin';
import '@/styles/pages/login.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('PLEASE FILL IN ALL FIELDS.');
      return;
    }
    if (!email.includes('@')) {
      setErrorMsg('PLEASE ENTER A VALID EMAIL.');
      return;
    }
    
    setErrorMsg('');
    setIsSubmitting(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message.toUpperCase());
      setIsSubmitting(false);
      return;
    }

    await supabase.auth.getSession();
    const { isAdmin } = await getCurrentAdmin();
    router.refresh();
    router.push(isAdmin ? '/admin' : '/');
  };

  return (
    <main className="login-page">
      <div className="login-wrap">
        <div className="login-header">
          <p className="login-label">✦ WELCOME BACK ✦</p>
          <h1 className="login-title">LOGIN</h1>
        </div>
        <div className="login-form">
          <div className="form-group">
            <label className="form-label">EMAIL</label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="YOUR EMAIL" 
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">PASSWORD</label>
            <div className="input-wrap">
              <input 
                type={showPassword ? "text" : "password"}
                className="form-input" 
                placeholder="YOUR PASSWORD" 
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <ion-icon 
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                className="eye-icon" 
                onClick={() => setShowPassword(!showPassword)}
                style={{ opacity: showPassword ? 0.4 : 1 }}
              ></ion-icon>
            </div>
          </div>
          <p className="form-error">{errorMsg}</p>
          <button 
            className="login-btn" 
            onClick={handleLogin}
            disabled={isSubmitting}
            style={{ opacity: isSubmitting ? 0.7 : 1 }}
          >
            {isSubmitting ? 'LOGGING IN...' : 'LOGIN ⟶'}
          </button>
          <p className="login-footer">
            DON'T HAVE AN ACCOUNT? <Link href="/register">CREATE ONE</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
