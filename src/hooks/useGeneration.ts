import { useState, useCallback } from 'react';
import { generateText, generateImage, improvePrompt, prepareImage } from '@/lib/api';
import { IMAGE_STYLES, type ImageGenerationParams, type TextGenerationParams } from '@/types';
import { detectLanguage } from '@/lib/i18n';

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

  const handleGenerateText = useCallback(async (
    prompt: string,
    options?: {
      narrative?: string;
      format_description?: string;
      transcript?: string;  // YouTube transcript for richer context
    },
    modalParams?: TextGenerationParams
  ) => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsGeneratingText(true);
    setError(null);

    try {
      // Use modal language if provided, otherwise detect from prompt
      const language = modalParams?.language || detectLanguage(prompt);
      console.log(`[useGeneration] Using language: ${language} for prompt: "${prompt.substring(0, 50)}..."`);

      // Build enhanced prompt with generation parameters
      let enhancedPrompt = prompt;

      if (modalParams) {
        const isRu = language === 'ru';

        // Text length instructions
        const lengthMap = {
          short: isRu ? '50-100 слов (кратко)' : '50-100 words (brief)',
          medium: isRu ? '150-250 слов (средний объём)' : '150-250 words (medium length)',
          long: isRu ? '300-500 слов (подробно)' : '300-500 words (detailed)',
        };

        // Emoji instructions
        const emojiMap = {
          none: isRu ? 'без эмодзи' : 'no emojis',
          few: isRu ? '1-2 эмодзи' : '1-2 emojis',
          moderate: isRu ? '3-5 эмодзи' : '3-5 emojis',
          many: isRu ? '6+ эмодзи, активно использовать' : '6+ emojis, use actively',
        };

        // Formatting instructions
        const formatMap = {
          none: isRu ? 'без форматирования, простой текст' : 'no formatting, plain text',
          simple: isRu ? 'простое форматирование (жирный **текст**, курсив *текст*) для Telegram' : 'simple formatting (bold **text**, italic *text*) for Telegram',
          markdown: isRu ? 'полное Markdown-форматирование (заголовки, списки, цитаты)' : 'full Markdown formatting (headers, lists, quotes)',
        };

        const instructions = [
          `${isRu ? 'Объём' : 'Length'}: ${lengthMap[modalParams.textLength]}`,
          `${isRu ? 'Эмодзи' : 'Emojis'}: ${emojiMap[modalParams.emojiDensity]}`,
          `${isRu ? 'Форматирование' : 'Formatting'}: ${formatMap[modalParams.formatting]}`,
          `${isRu ? 'Язык' : 'Language'}: ${isRu ? 'русский' : 'English'}`,
        ];

        if (modalParams.callToAction) {
          instructions.push(`${isRu ? 'Призыв к действию (CTA)' : 'Call to action (CTA)'}: ${modalParams.callToAction}`);
        } else {
          instructions.push(isRu ? 'Призыв к действию: сгенерируй подходящий CTA из контекста' : 'Call to action: generate appropriate CTA from context');
        }

        enhancedPrompt = `${prompt}\n\n---\n${isRu ? 'Параметры генерации' : 'Generation parameters'}:\n${instructions.map(i => `• ${i}`).join('\n')}`;

        console.log('[useGeneration] Enhanced prompt with params:', enhancedPrompt.substring(0, 200));
      }

      // When narrative context is present (from content analysis), embed it directly
      // in the prompt with clear instructions for the LLM to rewrite BASED ON the content
      if (options?.narrative) {
        const isRu = language === 'ru';
        const systemInstruction = isRu
          ? `ВАЖНО: Пользователь предоставил оригинальный контент (пост/видео) для переработки. Если в промпте написано "переписать", "переделать", "перепиши" и т.п. — генерируй контент НА ОСНОВЕ оригинального поста ниже, а НЕ про процесс переписывания. Используй ключевые мысли, факты и идеи из оригинала.`
          : `IMPORTANT: The user provided original content (post/video) for reworking. If the prompt says "rewrite", "rework", etc. — generate content BASED ON the original post below, NOT about the process of rewriting. Use key ideas, facts, and insights from the original.`;

        enhancedPrompt = `${systemInstruction}\n\n---\nПромпт пользователя: ${enhancedPrompt}\n\n---\nОригинальный контент:\n${options.narrative}`;

        if (options?.transcript && options.transcript !== options.narrative) {
          enhancedPrompt += `\n\n---\nТранскрипт видео:\n${options.transcript}`;
        }

        console.log('[useGeneration] Enhanced prompt with narrative context for rewrite');
      }

      const result = await generateText({
        prompt: enhancedPrompt,
        user_id: userId,
        tg_chat_id: tgChatId,
        post_id: postId || undefined,
        // Pass narrative context for rewriting posts (backup for n8n workflow)
        narrative: options?.narrative,
        format_description: options?.format_description,
        // Pass YouTube transcript for richer context
        transcript: options?.transcript,
        // Pass language for generation
        language,
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
      // Detect language from the prompt text
      const detectedLanguage = detectLanguage(prompt);
      console.log(`[useGeneration] Image gen - Detected language: ${detectedLanguage} for prompt: "${prompt.substring(0, 50)}..."`);

      // Build request with optional modal parameters
      const requestParams: Parameters<typeof generateImage>[0] = {
        prompt,
        user_id: effectiveUserId,
        tg_chat_id: effectiveTgChatId,
        post_id: postId || undefined,
        generated_text: generatedText || '',
        language: detectedLanguage,
      };

      // Add modal parameters if provided
      if (modalParams) {
        requestParams.scene_description = modalParams.sceneDescription;
        // If captions is empty, explicitly instruct to not add any text to the image
        if (modalParams.captions && modalParams.captions.trim()) {
          const caption = modalParams.captions.trim();
          requestParams.captions = `EXACT TEXT TO RENDER: "${caption}". Spell every letter correctly. The text "${caption}" must appear exactly as written, character by character.`;
        } else {
          // Explicit instruction to avoid any text on the image
          requestParams.captions = 'DO NOT add any text, lettering, inscriptions, words, labels, or captions to the image. The image must be purely visual with no text of any kind.';
        }
        requestParams.aspect_ratio = modalParams.aspectRatio;
        requestParams.style_id = modalParams.styleId;

        // Find and add style prompt
        const selectedStyle = IMAGE_STYLES.find((s) => s.id === modalParams.styleId);
        if (selectedStyle) {
          requestParams.style_prompt = selectedStyle.prompt;
        }

        // Add reference image parameters for style transfer
        if (modalParams.referenceImageUrl) {
          requestParams.reference_image_url = modalParams.referenceImageUrl;
          requestParams.use_reference_for_style = modalParams.useReferenceForStyle || false;
          requestParams.use_reference_for_composition = modalParams.useReferenceForComposition || false;
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
      // Detect language from the prompt text
      const detectedLanguage = detectLanguage(prompt);
      console.log(`[useGeneration] Prepare image - Detected language: ${detectedLanguage}`);

      const result = await prepareImage({
        prompt,
        user_id: effectiveUserId,
        generated_text: generatedText || '',
        language: detectedLanguage,
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
      // Detect language from the prompt text
      const detectedLanguage = detectLanguage(prompt);
      console.log(`[useGeneration] Improve prompt - Detected language: ${detectedLanguage}`);

      const improved = await improvePrompt({
        prompt,
        user_id: userId,
        post_id: postId || undefined,
        language: detectedLanguage,
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
