import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { LockKeyhole, LogIn } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useDocumentMeta({ title: 'Admin Login | Oky-Docky', canonical: '/admin/login', robots: 'noindex,nofollow' });

  useEffect(() => {
    fetch('/api/admin/session').then((response) => {
      if (response.ok) navigate('/admin', { replace: true });
      else if (response.status === 503) setError('Admin access is not configured. Run deploy-pi.sh on the server first.');
    }).catch(() => undefined);
  }, [navigate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || 'Login failed');
      }
      navigate('/admin', { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-white/70 bg-white/90 p-8 shadow-2xl backdrop-blur">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <div><h1 className="text-2xl font-bold text-slate-900">Admin access</h1><p className="text-sm text-slate-500">Metrics and form builder</p></div>
        </div>
        <div className="space-y-5">
          <div className="space-y-2"><Label htmlFor="admin-username">Username</Label><Input id="admin-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="admin-password">Password</Label><Input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 py-6 text-white">
            <LogIn className="mr-2 h-4 w-4" />{loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </div>
      </form>
    </div>
  );
}
