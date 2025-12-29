import { useState, useCallback } from 'react';
import { analyzeContentUrl, analyzeFile, type AnalysisResult } from '@/lib/api';
import { PRICING, type ContentUsageOption, type ContentAnalysisContext } from '@/types';

interface UseContentAnalysisOptions {
  userId: number;
  tgChatId: number;
  postId?: number | null;
}

export function useContentAnalysis({ userId, tgChatId, postId }: UseContentAnalysisOptions) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisContext, setAnalysisContext] = useState<ContentAnalysisContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sourceType, setSourceType] = useState<'url' | 'file'>('url');
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [sourceFileName, setSourceFileName] = useState<string>('');

  // Calculate analysis cost based on content type (for display purposes)
  const calculateAnalysisCost = useCallback((result: AnalysisResult): number => {
    let cost = 0;

    // Base cost for post analysis
    if (result.content_type === 'post' || result.post_text) {
      cost += PRICING.POST_ANALYSIS;
    }

    // Additional cost for image analysis
    if (result.has_image || result.content_type === 'image') {
      cost += PRICING.PHOTO_ANALYSIS;
    }

    // Additional cost for video analysis (per minute)
    if (result.has_video || result.content_type === 'video') {
      const minutes = result.video_duration_minutes || 1;
      cost += PRICING.VIDEO_ANALYSIS * minutes;
    }

    return cost;
  }, []);

  // Analyze URL (Instagram, TikTok, etc.)
  // Uses Supabase functions: charge-tokens, fetch-url-content (same as reelsgen)
  const handleAnalyzeUrl = useCallback(async (url: string) => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setSourceType('url');
    setSourceUrl(url);

    try {
      // This calls charge-tokens and fetch-url-content via Supabase
      const result = await analyzeContentUrl(url, userId, postId || undefined);

      setAnalysisResult(result);
      setShowModal(true);
    } catch (err: any) {
      console.error('Error analyzing content:', err);
      setError(err.message || 'Failed to analyze content. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [userId, postId]);

  // Analyze uploaded file
  // Uses Supabase storage + transcribe-content function (same as reelsgen)
  const handleAnalyzeFile = useCallback(async (file: File) => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload an image or video file');
      return;
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File size must be less than 50MB');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setSourceType('file');
    setSourceFileName(file.name);

    try {
      // This calls charge-tokens, uploads to storage, and calls transcribe-content
      const result = await analyzeFile(file, userId, postId || undefined);

      setAnalysisResult(result);
      setShowModal(true);
    } catch (err: any) {
      console.error('Error analyzing file:', err);
      setError(err.message || 'Failed to analyze file. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [userId, postId]);

  // Handle modal confirmation with selected options
  const handleConfirmOptions = useCallback((selectedOptions: ContentUsageOption[]) => {
    if (!analysisResult) return;

    const cost = calculateAnalysisCost(analysisResult);

    const context: ContentAnalysisContext = {
      source_type: sourceType,
      source_url: sourceType === 'url' ? sourceUrl : undefined,
      file_name: sourceType === 'file' ? sourceFileName : undefined,
      content_type: analysisResult.content_type,
      has_image: analysisResult.has_image,
      has_video: analysisResult.has_video,
      selected_options: selectedOptions,
      narrative: selectedOptions.includes('use_narrative') ? analysisResult.narrative : undefined,
      format_description: selectedOptions.includes('use_format') ? analysisResult.format_description : undefined,
      style_description: selectedOptions.includes('use_style') ? analysisResult.style_description : undefined,
      composition_description: selectedOptions.includes('use_composition') ? analysisResult.composition_description : undefined,
      scene_description: selectedOptions.includes('use_scene') ? analysisResult.scene_description : undefined,
      analysis_cost: cost,
    };

    setAnalysisContext(context);
    setShowModal(false);
  }, [analysisResult, sourceType, sourceUrl, sourceFileName, calculateAnalysisCost]);

  // Close modal and reset
  const handleCloseModal = useCallback(() => {
    setShowModal(false);
  }, []);

  // Clear analysis context
  const clearAnalysisContext = useCallback(() => {
    setAnalysisResult(null);
    setAnalysisContext(null);
    setSourceUrl('');
    setSourceFileName('');
  }, []);

  // Get estimated cost for current analysis
  const getEstimatedCost = useCallback(() => {
    if (!analysisResult) return 0;
    return calculateAnalysisCost(analysisResult);
  }, [analysisResult, calculateAnalysisCost]);

  return {
    isAnalyzing,
    analysisResult,
    analysisContext,
    error,
    showModal,
    sourceType,
    handleAnalyzeUrl,
    handleAnalyzeFile,
    handleConfirmOptions,
    handleCloseModal,
    clearAnalysisContext,
    getEstimatedCost,
  };
}
