import React, { useState } from 'react';
import { useAuth } from '@/core/auth/auth-context';
import { auth } from '@/core/services/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn } from 'lucide-react';
import { toast } from 'sonner';
import GlowixLogo from '@/components/ui/GlowixLogo';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Access denied.');
      toast.error("Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#1e1b4b,transparent)] opacity-50" />
      
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 relative z-10">
        <CardHeader className="space-y-2 text-center pb-8">
          <div className="mx-auto flex items-center justify-center mb-2">
            <GlowixLogo size={48} />
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">
            Glowix
          </CardTitle>
          <CardDescription className="text-zinc-500 font-mono text-sm uppercase tracking-widest">
            Enter authorized credentials
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest">Admin Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@admin.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-zinc-950 border-zinc-800 text-zinc-100 focus:ring-blue-500 h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" title="Enter password" className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-zinc-950 border-zinc-800 text-zinc-100 focus:ring-blue-500 h-11"
              />
            </div>
            {error && (
              <p className="text-[11px] text-red-500 bg-red-500/10 border border-red-500/20 p-3 rounded flex items-center font-mono italic">
                {error}
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 uppercase tracking-[1px] text-xs shadow-lg shadow-blue-900/20"
              disabled={loading}
            >
              <LogIn className="mr-2" size={18} />
              {loading ? 'Verifying...' : 'Authorize Access'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Login;
