import { SignInTrigger } from '@/auth';
import { Button } from '@/components/ui/button';
import { s } from '@/i18n';

export default function Landing() {
  return <main className="p-10"><h1>Slabs</h1><SignInTrigger><Button data-a="sign-in">{s.auth.signIn}</Button></SignInTrigger></main>;
}
