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
        // Get user_id and tg_chat_id from URL params (passed by n8n workflow)
        const urlParams = new URLSearchParams(window.location.search);
        const userIdParam = urlParams.get('user_id');
        const tgChatIdParam = urlParams.get('tg_chat_id');

        // Initialize Telegram WebApp if available
        const tgWebApp = window.Telegram?.WebApp;
        if (tgWebApp) {
          tgWebApp.ready();
          tgWebApp.expand();
        }

        if (!userIdParam) {
          console.error('[useUser] No user_id in URL params');
          setError('Missing user_id. Please open this app from Telegram bot.');
          setLoading(false);
          return;
        }

        const dbUserId = parseInt(userIdParam, 10);
        const tgChatId = tgChatIdParam ? parseInt(tgChatIdParam, 10) : null;
        console.log('[useUser] Got user_id:', dbUserId, 'tg_chat_id:', tgChatId);

        // Fetch user data from Supabase by internal DB id
        const { data, error: fetchError } = await supabase
          .from('user_data')
          .select('id, tg_chat_id, username, plan, balance, language')
          .eq('id', dbUserId)
          .single();

        if (fetchError) {
          console.error('Error fetching user:', fetchError);
          // Use fallback data from URL params
          setUser({
            id: dbUserId,
            tg_chat_id: tgChatId || dbUserId,
            plan: 'Free',
            units: 0,
            language: 'ru',
          });
        } else if (data) {
          const balance = data.balance || 0;

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
