import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PostSession {
  id: number;
  user_id: number;
  tg_chat_id: number;
  status: string;
  prompt?: string;
  generated_text?: string;
  generated_image_url?: string;
  source_url?: string;
  scraped_data?: Record<string, unknown>;
  artifacts?: string[];
  created_at: string;
}

interface UseSessionOptions {
  userId: number;
  tgChatId: number;
}

export function useSession({ userId, tgChatId }: UseSessionOptions) {
  const [session, setSession] = useState<PostSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create new session (post) when mini-app loads
  const createSession = useCallback(async () => {
    if (!userId || userId <= 0) {
      console.error('[useSession] Invalid userId:', userId);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[useSession] Creating new session for user:', userId);

      const { data, error: insertError } = await supabase
        .from('posts')
        .insert({
          user_id: userId,
          tg_chat_id: tgChatId || userId,
          status: 'draft',
          session_type: 'post_miniapp',
          platform: 'Telegram',
        })
        .select()
        .single();

      if (insertError) {
        console.error('[useSession] Error creating session:', insertError);
        setError('Failed to create session');
        return null;
      }

      console.log('[useSession] Session created:', data.id);
      setSession(data as PostSession);
      return data as PostSession;
    } catch (err) {
      console.error('[useSession] Exception:', err);
      setError('Failed to create session');
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId, tgChatId]);

  // Update session with new data
  const updateSession = useCallback(async (updates: Partial<PostSession>) => {
    if (!session?.id) {
      console.error('[useSession] No active session to update');
      return false;
    }

    try {
      console.log('[useSession] Updating session:', session.id, updates);

      const { data, error: updateError } = await supabase
        .from('posts')
        .update(updates)
        .eq('id', session.id)
        .select()
        .single();

      if (updateError) {
        console.error('[useSession] Error updating session:', updateError);
        return false;
      }

      setSession(data as PostSession);
      return true;
    } catch (err) {
      console.error('[useSession] Exception during update:', err);
      return false;
    }
  }, [session?.id]);

  // Add artifact URL to session
  const addArtifact = useCallback(async (artifactUrl: string) => {
    if (!session?.id) return false;

    const currentArtifacts = session.artifacts || [];
    const newArtifacts = [...currentArtifacts, artifactUrl];

    return updateSession({ artifacts: newArtifacts } as any);
  }, [session, updateSession]);

  // Mark session as completed
  const completeSession = useCallback(async () => {
    return updateSession({ status: 'completed' });
  }, [updateSession]);

  // Initialize session on mount
  useEffect(() => {
    if (userId > 0 && !session) {
      createSession();
    }
  }, [userId, createSession, session]);

  return {
    session,
    loading,
    error,
    createSession,
    updateSession,
    addArtifact,
    completeSession,
    postId: session?.id || null,
  };
}
