import { useState, useCallback, useRef } from 'react';
import { transcribeVoice } from '@/lib/api';

interface UseVoiceInputOptions {
  onTranscript?: (text: string) => void;
  onError?: (error: string) => void;
  userId?: number;
}

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startListening = useCallback(async () => {
    try {
      setError(null);

      // Check if MediaRecorder is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const errorMsg = 'Microphone access not supported in this browser';
        setError(errorMsg);
        options.onError?.(errorMsg);
        return;
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create MediaRecorder with webm format (best compatibility)
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Create audio blob from chunks
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm'
        });

        // Stop all tracks to release microphone
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Send to n8n for transcription
        if (audioBlob.size > 0) {
          setIsProcessing(true);
          try {
            const userId = options.userId || 0;
            const text = await transcribeVoice(audioBlob, userId);

            if (text && text.trim()) {
              options.onTranscript?.(text.trim());
            } else {
              const errorMsg = 'No speech detected';
              setError(errorMsg);
              options.onError?.(errorMsg);
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to transcribe voice';
            console.error('Voice transcription error:', err);
            setError(errorMsg);
            options.onError?.(errorMsg);
          } finally {
            setIsProcessing(false);
          }
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        const errorMsg = 'Recording error occurred';
        setError(errorMsg);
        options.onError?.(errorMsg);
        setIsListening(false);
      };

      // Start recording
      mediaRecorder.start();
      setIsListening(true);

    } catch (err) {
      console.error('Error accessing microphone:', err);
      let errorMsg = 'Could not access microphone';

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMsg = 'Microphone access denied. Please allow microphone access.';
        } else if (err.name === 'NotFoundError') {
          errorMsg = 'No microphone found';
        }
      }

      setError(errorMsg);
      options.onError?.(errorMsg);
      setIsListening(false);
    }
  }, [options]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isProcessing, // New: true while transcribing
    error,
    startListening,
    stopListening,
    toggleListening,
  };
}
