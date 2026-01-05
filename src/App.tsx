import { useState } from 'react';
import { Toaster, toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/hooks/useUser';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useGeneration } from '@/hooks/useGeneration';
import { useContentAnalysis } from '@/hooks/useContentAnalysis';
import { useSession } from '@/hooks/useSession';
import { ContentAnalyzer } from '@/components/ContentAnalyzer';
import { AnalysisModal } from '@/components/AnalysisModal';
import { ImageGenerationModal } from '@/components/ImageGenerationModal';
import { Mic, MicOff, Wand2, FileText, Image, Loader2, Send, Coins } from 'lucide-react';
import { PRICING, type ImageGenerationParams } from '@/types';
import { translations, type Language } from '@/lib/i18n';

// Simple markdown to HTML converter for basic formatting
function formatMarkdown(text: string): string {
  return text
    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Strikethrough: ~~text~~
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // Inline code: `code`
    .replace(/`(.+?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs">$1</code>')
    // Line breaks
    .replace(/\n/g, '<br/>');
}

function App() {
  const { user, loading: userLoading, error: userError } = useUser();
  const [prompt, setPrompt] = useState('');
  const [showImageModal, setShowImageModal] = useState(false);

  // Get language with fallback to Russian
  const lang: Language = (user?.language === 'en' ? 'en' : 'ru');
  const t = (key: keyof typeof translations) => {
    const translation = translations[key];
    if (typeof translation === 'object' && lang in translation) {
      const value = translation[lang as keyof typeof translation];
      if (typeof value === 'string') return value;
    }
    return key;
  };

  // Session management - creates a post record for this session
  const {
    session,
    postId,
    updateSession,
    loading: sessionLoading,
  } = useSession({
    userId: user?.id || 0,
    tgChatId: user?.tg_chat_id || 0,
  });

  const { isListening, isProcessing: isVoiceProcessing, toggleListening } = useVoiceInput({
    userId: user?.id || 0,
    onTranscript: (text) => {
      setPrompt((prev) => prev ? prev + ' ' + text : text);
      toast.success(t('voiceTranscribed'));
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const {
    isGeneratingText,
    isGeneratingImage,
    isImproving,
    isPreparing,
    generatedText,
    generatedImage,
    preparedData,
    error: generationError,
    handleGenerateText,
    handleGenerateImage,
    handlePrepareImage,
    handleImprovePrompt,
    reset,
    clearPreparedData,
  } = useGeneration({
    userId: user?.id || 0,
    tgChatId: user?.tg_chat_id || 0,
    postId,
  });

  const {
    isAnalyzing,
    analysisResult,
    analysisContext,
    error: analysisError,
    showModal,
    sourceType,
    handleAnalyzeUrl,
    handleAnalyzeFile,
    handleConfirmOptions,
    handleCloseModal,
    clearAnalysisContext,
    getEstimatedCost,
  } = useContentAnalysis({
    userId: user?.id || 0,
    tgChatId: user?.tg_chat_id || 0,
    postId,
  });

  const handleMagicWand = async () => {
    if (!prompt.trim()) {
      toast.error(t('enterPromptFirst'));
      return;
    }
    const improved = await handleImprovePrompt(prompt);
    setPrompt(improved);
    toast.success(t('promptImproved'));
  };

  const handleGenText = () => {
    // Pass narrative/format context if available from content analysis
    handleGenerateText(prompt, {
      narrative: analysisContext?.narrative,
      format_description: analysisContext?.format_description,
    });
  };

  const handleGenImage = async () => {
    if (!prompt.trim()) {
      toast.error(t('enterPromptFirst'));
      return;
    }

    // First, prepare image data (get AI-generated scene description and captions)
    const prepared = await handlePrepareImage(prompt, user?.id);

    if (prepared) {
      // Open modal with prepared data
      setShowImageModal(true);
    }
    // If preparation failed, error will be shown via generationError
  };

  const handleImageModalConfirm = (params: ImageGenerationParams) => {
    // Close modal and start generation with modal parameters
    setShowImageModal(false);

    // Enhance params with reference image from analysis context if available
    const enhancedParams: ImageGenerationParams = {
      ...params,
      referenceImageUrl: analysisContext?.reference_image_url,
      useReferenceForStyle: analysisContext?.selected_options?.includes('use_style'),
      useReferenceForComposition: analysisContext?.selected_options?.includes('use_composition'),
    };

    handleGenerateImage(prompt, user?.id, user?.tg_chat_id, enhancedParams);
  };

  const handleImageModalClose = () => {
    setShowImageModal(false);
    clearPreparedData();
  };

  const handleReset = () => {
    setPrompt('');
    reset();
    clearAnalysisContext();
  };

  // Handle analysis confirmation with toast notification
  const onAnalysisConfirm = (selectedOptions: string[]) => {
    handleConfirmOptions(selectedOptions as any);
    toast.success(t('contextAdded'));
  };

  // Loading state
  if (userLoading || sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (userError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <p className="text-destructive text-center">{userError}</p>
            <p className="text-muted-foreground text-sm text-center mt-2">
              {t('openFromTelegram')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isGenerating = isGeneratingText || isGeneratingImage || isPreparing;

  return (
    <div className="min-h-screen bg-background safe-area-top safe-area-bottom">
      <div className="container max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Header with balance */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">{t('appTitle')}</h1>
          <div className="flex items-center gap-2 text-sm">
            <Coins className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">${(user?.units || 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Content Analyzer */}
        <ContentAnalyzer
          isAnalyzing={isAnalyzing}
          analysisContext={analysisContext}
          error={analysisError}
          onAnalyzeUrl={handleAnalyzeUrl}
          onAnalyzeFile={handleAnalyzeFile}
          onClearContext={clearAnalysisContext}
          language={lang}
          disabled={isGenerating}
        />

        {/* Prompt Input Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t('enterPrompt')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Textarea with voice button */}
            <div className="relative">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t('promptPlaceholder')}
                className="min-h-[120px] pr-12 resize-none"
                disabled={isGenerating}
              />
              <Button
                variant="ghost"
                size="icon"
                className={`absolute right-2 top-2 ${isListening ? 'text-destructive animate-pulse' : isVoiceProcessing ? 'text-primary' : 'text-muted-foreground'}`}
                onClick={toggleListening}
                disabled={isGenerating || isVoiceProcessing}
              >
                {isVoiceProcessing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isListening ? (
                  <MicOff className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>
            </div>

            {/* Magic Wand Button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleMagicWand}
              disabled={isImproving || isGenerating || !prompt.trim()}
            >
              {isImproving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              {t('improvePrompt')}
            </Button>

            {/* Generate Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleGenText}
                disabled={isGenerating || !prompt.trim()}
                className="flex-1"
              >
                {isGeneratingText ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                {t('generateText')}
              </Button>
              <Button
                onClick={handleGenImage}
                disabled={isGenerating || !prompt.trim()}
                variant="secondary"
                className="flex-1"
              >
                {isPreparing || isGeneratingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Image className="h-4 w-4 mr-2" />
                )}
                {isPreparing ? t('preparing') : t('generateImage')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {generationError && (
          <Card className="border-destructive">
            <CardContent className="pt-4">
              <p className="text-destructive text-sm">{generationError}</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {(generatedText || generatedImage) && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{t('result')}</CardTitle>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  {t('clear')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {generatedText && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{t('generatedText')}</p>
                  <div className="p-3 bg-secondary rounded-lg">
                    <div
                      className="text-sm prose prose-sm prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: formatMarkdown(generatedText) }}
                    />
                  </div>
                </div>
              )}

              {generatedImage && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{t('generatedImage')}</p>
                  <div className="rounded-lg overflow-hidden">
                    <img
                      src={generatedImage}
                      alt="Generated"
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              )}

              {/* Sent to Telegram indicator */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Send className="h-4 w-4" />
                <span>{t('sentToTelegram')}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pricing Info Footer */}
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>{t('pricing')}</p>
          <p>
            {lang === 'ru'
              ? `Текст: $${PRICING.TEXT_GENERATION}/1000 слов • Изображение: $${PRICING.IMAGE_GENERATION}`
              : `Text: $${PRICING.TEXT_GENERATION}/1000 words • Image: $${PRICING.IMAGE_GENERATION}`}
          </p>
          <p>
            {lang === 'ru'
              ? `Анализ: пост $${PRICING.POST_ANALYSIS} • фото $${PRICING.PHOTO_ANALYSIS} • видео $${PRICING.VIDEO_ANALYSIS}/мин`
              : `Analysis: post $${PRICING.POST_ANALYSIS} • photo $${PRICING.PHOTO_ANALYSIS} • video $${PRICING.VIDEO_ANALYSIS}/min`}
          </p>
        </div>
      </div>

      {/* Analysis Options Modal */}
      <AnalysisModal
        isOpen={showModal}
        onClose={handleCloseModal}
        onConfirm={onAnalysisConfirm}
        analysisResult={analysisResult}
        sourceType={sourceType}
        estimatedCost={getEstimatedCost()}
        userUnits={user?.units || 0}
        language={lang}
      />

      {/* Image Generation Modal */}
      <ImageGenerationModal
        isOpen={showImageModal}
        onClose={handleImageModalClose}
        onConfirm={handleImageModalConfirm}
        initialSceneDescription={preparedData?.sceneDescription || prompt}
        initialCaptions={preparedData?.captions || ''}
        language={lang}
        isLoading={isGeneratingImage}
        referenceImageUrl={analysisContext?.use_reference_image ? analysisContext.reference_image_url : undefined}
      />

      <Toaster />
    </div>
  );
}

export default App;
