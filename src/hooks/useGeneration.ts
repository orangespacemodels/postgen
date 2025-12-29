import { useState, useCallback } from 'react';
import { generateText, generateImage, improvePrompt } from '@/lib/api';

interface UseGenerationOptions {
  userId: number;
  tgChatId: number;
  postId?: number | null;
}

export function useGeneration({ userId, tgChatId, postId }: UseGenerationOptions) {
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateText = useCallback(async (prompt: string) => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsGeneratingText(true);
    setError(null);

    try {
      const result = await generateText({
        prompt,
        user_id: userId,
        tg_chat_id: tgChatId,
        post_id: postId || undefined,
      });
      setGeneratedText(result.text);
    } catch (err) {
      console.error('Error generating text:', err);
      setError('Failed to generate text. Please try again.');
    } finally {
      setIsGeneratingText(false);
    }
  }, [userId, tgChatId, postId]);

  const handleGenerateImage = useCallback(async (prompt: string, currentUserId?: number, currentTgChatId?: number) => {
    // Use passed values or fall back to hook values
    const effectiveUserId = currentUserId || userId;
    const effectiveTgChatId = currentTgChatId || tgChatId;

    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    // Debug: log userId before sending
    console.log('[useGeneration] handleGenerateImage called with userId:', effectiveUserId, 'tgChatId:', effectiveTgChatId);

    if (!effectiveUserId || effectiveUserId <= 0) {
      console.error('[useGeneration] Invalid userId:', effectiveUserId);
      setError('User not loaded. Please reload the app.');
      return;
    }

    setIsGeneratingImage(true);
    setError(null);

    try {
      const result = await generateImage({
        prompt,
        user_id: effectiveUserId,
        tg_chat_id: effectiveTgChatId,
        post_id: postId || undefined,
        generated_text: generatedText || '',
      });
      setGeneratedImage(result.image_url);
    } catch (err) {
      console.error('Error generating image:', err);
      setError('Failed to generate image. Please try again.');
    } finally {
      setIsGeneratingImage(false);
    }
  }, [userId, tgChatId, postId, generatedText]);

  const handleImprovePrompt = useCallback(async (prompt: string): Promise<string> => {
    if (!prompt.trim()) {
      return prompt;
    }

    setIsImproving(true);
    setError(null);

    try {
      const improved = await improvePrompt({
        prompt,
        user_id: userId,
        post_id: postId || undefined,
      });
      return improved;
    } catch (err) {
      console.error('Error improving prompt:', err);
      setError('Failed to improve prompt');
      return prompt;
    } finally {
      setIsImproving(false);
    }
  }, [userId, postId]);

  const reset = useCallback(() => {
    setGeneratedText(null);
    setGeneratedImage(null);
    setError(null);
  }, []);

  return {
    isGeneratingText,
    isGeneratingImage,
    isImproving,
    generatedText,
    generatedImage,
    error,
    handleGenerateText,
    handleGenerateImage,
    handleImprovePrompt,
    reset,
  };
}
