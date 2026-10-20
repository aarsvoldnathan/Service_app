import { useRouter } from 'expo-router';
import { useEffect } from 'react';

/** Microsoft sign-in returns to serviceceo://auth; the sign-in window handles it, so just go back. */
export default function AuthReturn() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/')), 50);
    return () => clearTimeout(t);
  }, [router]);
  return null;
}
