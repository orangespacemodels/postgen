import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { UserData } from '@/types';

// Telegram WebApp type declaration
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name?: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
          chat?: {
            id: number;
          };
        };
        ready: () => void;
        expand: () => void;
      };
    };
  }
}

export function useUser() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Get internal_token from URL params (passed by n8n workflow)
        // Security: We no longer expose user_id in URL, only internal_token
        const urlParams = new URLSearchParams(window.location.search);
        const internalToken = urlParams.get('internal_token');

        // Initialize Telegram WebApp if available
        const tgWebApp = window.Telegram?.WebApp;
        if (tgWebApp) {
          tgWebApp.ready();
          tgWebApp.expand();
        }

        if (!internalToken) {
          console.error('[useUser] No internal_token in URL params');
          setError('Missing internal_token. Please open this app from Telegram bot.');
          setLoading(false);
          return;
        }

        console.log('[useUser] Got internal_token, fetching user data...');

        // Fetch user data from Supabase by internal_token
        const { data, error: fetchError } = await supabase
          .from('user_data')
          .select('id, tg_chat_id, username, plan, balance, language')
          .eq('internal_token', internalToken)
          .single();

        if (fetchError) {
          console.error('[useUser] Error fetching user by internal_token:', fetchError);
          setError('Invalid token. Please open this app from Telegram bot.');
          setLoading(false);
          return;
        }

        if (data) {
          const balance = data.balance || 0;

          console.log('[useUser] User found:', {
            id: data.id,
            tg_chat_id: data.tg_chat_id,
            username: data.username,
          });

          // Check if balance is negative - block access
          if (balance < 0) {
            setError('Insufficient balance. Please top up your account to continue.');
            setLoading(false);
            return;
          }

          // Map balance to units for UI compatibility
          setUser({
            id: data.id,
            tg_chat_id: data.tg_chat_id,
            username: data.username,
            plan: data.plan || 'Free',
            units: balance, // Map balance column to units
            language: data.language || 'ru',
          });
        }
      } catch (err) {
        console.error('Error loading user:', err);
        setError('Failed to load user data');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  return { user, loading, error };
}
