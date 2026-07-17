import { useState, useEffect, useCallback } from 'react';
import type { User, AuthState } from '../types/auth';
import { GoogleOAuth } from './GoogleOAuth';
import { getFromStorage, removeFromStorage, setToStorage } from '../utils/storageHelpers';
import { STORAGE_KEYS } from '../config/constants';

export function useAuth(): AuthState & {
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
} {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const googleOAuth = GoogleOAuth.getInstance();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (googleOAuth.isAuthenticated()) {
        setUser(googleOAuth.getCurrentUser());
      } else {
        const storedUser = getFromStorage<User | null>(STORAGE_KEYS.USER_INFO, null);
        if (storedUser) {
          setUser(storedUser);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  }, [googleOAuth]);

  const signIn = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const signedInUser = await googleOAuth.signIn();
      setUser(signedInUser);
      setToStorage(STORAGE_KEYS.USER_INFO, signedInUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setIsLoading(false);
    }
  }, [googleOAuth]);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await googleOAuth.signOut();
      setUser(null);
      removeFromStorage(STORAGE_KEYS.USER_INFO);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign out failed');
    } finally {
      setIsLoading(false);
    }
  }, [googleOAuth]);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    signIn,
    signOut
  };
}
