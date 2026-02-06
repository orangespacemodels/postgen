import { useState, useCallback, useRef, useEffect } from 'react';

interface UseVoiceInputOptions {
  onTranscript?: (text: string) => void;
  onError?: (error: string) => void;
  userId?: number;
  maxDuration?: number; // Maximum recording duration in ms (default: 10000)
}

const WAVEFORM_BARS = 50; // Number of bars in waveform visualization

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const { maxDuration = 10000 } = options;

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [waveformHistory, setWaveformHistory] = useState<number[]>(Array(WAVEFORM_BARS).fill(0));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isRecordingRef = useRef(false);
  const frameCounterRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    isRecordingRef.current = false;
    setIsListening(false);
    setAudioLevel(0);
    setWaveformHistory(Array(WAVEFORM_BARS).fill(0));

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }

    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

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
      console.log('[useVoiceInput] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create audio analyzer for visualization
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8; // Smooth animation

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Update audio level for visualization with scrolling waveform
      const updateAudioLevel = () => {
        if (!isRecordingRef.current) return;

        // Get data from analyzer
        analyser.getByteTimeDomainData(dataArray);

        // Calculate amplitude (deviation from 128)
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / bufferLength);
        const normalizedLevel = Math.min(rms * 3, 1); // Scale and clamp to 0-1

        setAudioLevel(normalizedLevel);

        // Update waveform history with reduced frequency
        frameCounterRef.current++;
        if (frameCounterRef.current % 3 === 0) {
          setWaveformHistory(prev => {
            const newHistory = [...prev.slice(1), normalizedLevel];
            return newHistory;
          });
        }

        requestAnimationFrame(updateAudioLevel);
      };

      isRecordingRef.current = true;
      frameCounterRef.current = 0;
      updateAudioLevel();

      // Create MediaRecorder with webm format
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
        console.log('[useVoiceInput] Recording stopped, processing...');
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        // Send to backend API for transcription (OpenAI Whisper)
        if (audioBlob.size > 0) {
          setIsProcessing(true);
          try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');

            console.log('[useVoiceInput] Sending to backend speech-to-text API...');
            let response: Response | undefined;
            const maxRetries = 3;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                response = await fetch('/api/speech-to-text', {
                  method: 'POST',
                  body: formData,
                });
                if (response.ok || response.status < 500) break;
                if (attempt < maxRetries) {
                  console.warn(`[useVoiceInput] Attempt ${attempt}/${maxRetries} failed (${response.status}), retrying...`);
                  await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
                }
              } catch (fetchErr) {
                if (attempt === maxRetries) throw fetchErr;
                console.warn(`[useVoiceInput] Attempt ${attempt}/${maxRetries} error, retrying...`, fetchErr);
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
              }
            }

            if (!response || !response.ok) {
              const errorData = response ? await response.json().catch(() => ({})) : {};
              throw new Error(errorData.detail || `API error: ${response?.status || 'no response'}`);
            }

            const data = await response.json();

            if (data?.transcript) {
              console.log('[useVoiceInput] Transcribed:', data.transcript);
              options.onTranscript?.(data.transcript);
            } else {
              const errorMsg = 'No speech detected';
              setError(errorMsg);
              options.onError?.(errorMsg);
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to transcribe voice';
            console.error('[useVoiceInput] Transcription error:', err);
            setError(errorMsg);
            options.onError?.(errorMsg);
          } finally {
            setIsProcessing(false);
          }
        }

        cleanup();
      };

      mediaRecorder.onerror = (event) => {
        console.error('[useVoiceInput] MediaRecorder error:', event);
        const errorMsg = 'Recording error occurred';
        setError(errorMsg);
        options.onError?.(errorMsg);
        cleanup();
      };

      // Start recording
      mediaRecorder.start();
      setIsListening(true);
      console.log('[useVoiceInput] Recording started...');

      // Auto-stop after maxDuration
      timeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          console.log(`[useVoiceInput] Auto-stopping after ${maxDuration}ms`);
          mediaRecorderRef.current.stop();
        }
      }, maxDuration);

    } catch (err) {
      console.error('[useVoiceInput] Microphone error:', err);
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
      cleanup();
    }
  }, [options, maxDuration, cleanup]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    // Note: cleanup is called in onstop handler
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
    isProcessing, // true while transcribing
    error,
    audioLevel, // Current audio level (0-1)
    waveformHistory, // Array of 50 audio levels for waveform display
    startListening,
    stopListening,
    toggleListening,
  };
}
