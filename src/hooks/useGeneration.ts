import { useState, useCallback } from 'react';
import { generateText, generateImage, improvePrompt, prepareImage } from '@/lib/api';
import { IMAGE_STYLES, type ImageGenerationParams } from '@/types';

export interface PreparedImageData {
  sceneDescription: string;
  captions: string;
}

interface UseGenerationOptions {
  userId: number;
  tgChatId: number;
  postId?: number | null;
}

export function useGeneration({ userId, tgChatId, postId }: UseGenerationOptions) {
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [preparedData, setPreparedData] = useState<PreparedImageData | null>(null);
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

  const handleGenerateImage = useCallback(async (
    prompt: string,
    currentUserId?: number,
    currentTgChatId?: number,
    modalParams?: ImageGenerationParams
  ) => {
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
      // Build request with optional modal parameters
      const requestParams: Parameters<typeof generateImage>[0] = {
        prompt,
        user_id: effectiveUserId,
        tg_chat_id: effectiveTgChatId,
        post_id: postId || undefined,
        generated_text: generatedText || '',
      };

      // Add modal parameters if provided
      if (modalParams) {
        requestParams.scene_description = modalParams.sceneDescription;
        requestParams.captions = modalParams.captions || undefined;
        requestParams.aspect_ratio = modalParams.aspectRatio;
        requestParams.style_id = modalParams.styleId;

        // Find and add style prompt
        const selectedStyle = IMAGE_STYLES.find((s) => s.id === modalParams.styleId);
        if (selectedStyle) {
          requestParams.style_prompt = selectedStyle.prompt;
        }
      }

      const result = await generateImage(requestParams);
      setGeneratedImage(result.image_url);
    } catch (err) {
      console.error('Error generating image:', err);
      setError('Failed to generate image. Please try again.');
    } finally {
      setIsGeneratingImage(false);
    }
  }, [userId, tgChatId, postId, generatedText]);

  // Prepare image - generates scene_description and captions via AI
  const handlePrepareImage = useCallback(async (
    prompt: string,
    currentUserId?: number
  ): Promise<PreparedImageData | null> => {
    const effectiveUserId = currentUserId || userId;

    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return null;
    }

    if (!effectiveUserId || effectiveUserId <= 0) {
      setError('User not loaded. Please reload the app.');
      return null;
    }

    setIsPreparing(true);
    setError(null);

    try {
      const result = await prepareImage({
        prompt,
        user_id: effectiveUserId,
        generated_text: generatedText || '',
      });

      const prepared: PreparedImageData = {
        sceneDescription: result.scene_description,
        captions: result.captions,
      };

      setPreparedData(prepared);
      return prepared;
    } catch (err) {
      console.error('Error preparing image:', err);
      setError('Failed to prepare image. Please try again.');
      return null;
    } finally {
      setIsPreparing(false);
    }
  }, [userId, generatedText]);

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
    setPreparedData(null);
    setError(null);
  }, []);

  const clearPreparedData = useCallback(() => {
    setPreparedData(null);
  }, []);

  return {
    isGeneratingText,
    isGeneratingImage,
    isImproving,
    isPreparing,
    generatedText,
    generatedImage,
    preparedData,
    error,
    handleGenerateText,
    handleGenerateImage,
    handlePrepareImage,
    handleImprovePrompt,
    reset,
    clearPreparedData,
  };
}
