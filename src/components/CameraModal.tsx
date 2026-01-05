import { useState, useRef, useEffect, useCallback } from 'react';
import { X, SwitchCamera, Camera, Video, Check, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  language: string;
}

type CaptureMode = 'photo' | 'video';

interface CameraDevice {
  deviceId: string;
  label: string;
}

export function CameraModal({ isOpen, onClose, onCapture, language }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<CaptureMode>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(1);
  const [capturedMedia, setCapturedMedia] = useState<{ url: string; file: File } | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isRussian = language === 'ru';

  // Get available cameras
  const getCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `${isRussian ? 'Камера' : 'Camera'} ${index + 1}`,
        }));
      setCameras(videoDevices);
    } catch (err) {
      console.error('Error getting cameras:', err);
    }
  }, [isRussian]);

  // Start camera stream
  const startCamera = useCallback(async (deviceId?: string) => {
    try {
      setIsInitializing(true);
      setError(null);

      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: deviceId ? undefined : 'environment',
        },
        audio: mode === 'video',
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Check zoom capabilities
      const videoTrack = stream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities?.() as MediaTrackCapabilities & {
        zoom?: { min: number; max: number; step: number };
      };

      if (capabilities?.zoom) {
        setMinZoom(capabilities.zoom.min);
        setMaxZoom(capabilities.zoom.max);
        setZoom(capabilities.zoom.min);
      } else {
        setMinZoom(1);
        setMaxZoom(1);
        setZoom(1);
      }

      setIsInitializing(false);
    } catch (err) {
      console.error('Error starting camera:', err);
      setError(isRussian ? 'Не удалось получить доступ к камере' : 'Could not access camera');
      setIsInitializing(false);
    }
  }, [mode, isRussian]);

  // Initialize camera on open
  useEffect(() => {
    if (isOpen) {
      getCameras().then(() => {
        startCamera(cameras[currentCameraIndex]?.deviceId);
      });
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen]);

  // Switch camera
  const switchCamera = useCallback(() => {
    if (cameras.length <= 1) return;
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    startCamera(cameras[nextIndex]?.deviceId);
  }, [cameras, currentCameraIndex, startCamera]);

  // Apply zoom
  useEffect(() => {
    if (streamRef.current && maxZoom > 1) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      const constraints = videoTrack.getConstraints() as MediaTrackConstraints & { advanced?: Array<{ zoom: number }> };

      try {
        videoTrack.applyConstraints({
          ...constraints,
          advanced: [{ zoom }],
        } as MediaTrackConstraints);
      } catch (err) {
        console.error('Error applying zoom:', err);
      }
    }
  }, [zoom, maxZoom]);

  // Recording timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Take photo
  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setCapturedMedia({
          url: URL.createObjectURL(blob),
          file,
        });
      },
      'image/jpeg',
      0.9
    );
  }, []);

  // Start/stop video recording
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      // Start recording
      if (!streamRef.current) return;

      chunksRef.current = [];
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp9',
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const file = new File([blob], `video_${Date.now()}.webm`, { type: 'video/webm' });
        setCapturedMedia({
          url: URL.createObjectURL(blob),
          file,
        });
        setRecordingTime(0);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    }
  }, [isRecording]);

  // Confirm captured media
  const confirmCapture = useCallback(() => {
    if (capturedMedia) {
      onCapture(capturedMedia.file);
      onClose();
    }
  }, [capturedMedia, onCapture, onClose]);

  // Retake
  const retake = useCallback(() => {
    if (capturedMedia?.url) {
      URL.revokeObjectURL(capturedMedia.url);
    }
    setCapturedMedia(null);
  }, [capturedMedia]);

  // Format time for recording
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on close
  const handleClose = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (capturedMedia?.url) {
      URL.revokeObjectURL(capturedMedia.url);
    }
    setCapturedMedia(null);
    setIsRecording(false);
    setRecordingTime(0);
    setZoom(1);
    onClose();
  }, [capturedMedia, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Bar - iOS style */}
      <div className="absolute top-0 left-0 right-0 z-20 safe-area-top">
        <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
          <button
            onClick={handleClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-md active:bg-white/30 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* Recording indicator */}
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/90 backdrop-blur-md">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-white text-sm font-medium tabular-nums">
                {formatTime(recordingTime)}
              </span>
            </div>
          )}

          {/* Camera switch button */}
          {cameras.length > 1 && !capturedMedia && (
            <button
              onClick={switchCamera}
              disabled={isInitializing}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-md active:bg-white/30 transition-colors disabled:opacity-50"
            >
              <SwitchCamera className="w-5 h-5 text-white" />
            </button>
          )}

          {cameras.length <= 1 && !capturedMedia && <div className="w-10" />}
        </div>
      </div>

      {/* Camera Preview / Captured Media */}
      <div className="absolute inset-0 flex items-center justify-center">
        {error ? (
          <div className="text-center px-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
              <Camera className="w-8 h-8 text-white/50" />
            </div>
            <p className="text-white/70 text-sm">{error}</p>
          </div>
        ) : capturedMedia ? (
          capturedMedia.file.type.startsWith('video') ? (
            <video
              src={capturedMedia.url}
              className="w-full h-full object-contain"
              controls
              autoPlay
              loop
            />
          ) : (
            <img
              src={capturedMedia.url}
              alt="Captured"
              className="w-full h-full object-contain"
            />
          )
        ) : (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />
        )}

        {/* Loading overlay */}
        {isInitializing && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Zoom Control - iOS style slider */}
      {!capturedMedia && maxZoom > 1 && !error && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-44 z-20 w-64">
          <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md">
            <ZoomOut className="w-4 h-4 text-white/70" />
            <input
              type="range"
              min={minZoom}
              max={maxZoom}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-white/30 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-5
                [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-white
                [&::-webkit-slider-thumb]:shadow-lg"
            />
            <ZoomIn className="w-4 h-4 text-white/70" />
          </div>
          <div className="text-center mt-1">
            <span className="text-xs text-white/60 font-medium tabular-nums">
              {zoom.toFixed(1)}x
            </span>
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 safe-area-bottom">
        <div className="pb-8 pt-4 bg-gradient-to-t from-black/80 to-transparent">
          {capturedMedia ? (
            /* Confirmation buttons */
            <div className="flex items-center justify-center gap-8 px-4">
              <button
                onClick={retake}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-14 h-14 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-md active:bg-white/30 transition-colors">
                  <RotateCcw className="w-6 h-6 text-white" />
                </div>
                <span className="text-white/70 text-xs">
                  {isRussian ? 'Переснять' : 'Retake'}
                </span>
              </button>

              <button
                onClick={confirmCapture}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-14 h-14 flex items-center justify-center rounded-full bg-primary active:bg-primary/80 transition-colors">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <span className="text-white/70 text-xs">
                  {isRussian ? 'Использовать' : 'Use'}
                </span>
              </button>
            </div>
          ) : (
            <>
              {/* Mode switcher - iOS style pill */}
              <div className="flex justify-center mb-6">
                <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/10 backdrop-blur-md">
                  <button
                    onClick={() => setMode('photo')}
                    disabled={isRecording}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                      mode === 'photo'
                        ? 'bg-white text-black'
                        : 'text-white/70 active:text-white'
                    }`}
                  >
                    {isRussian ? 'Фото' : 'Photo'}
                  </button>
                  <button
                    onClick={() => setMode('video')}
                    disabled={isRecording}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                      mode === 'video'
                        ? 'bg-white text-black'
                        : 'text-white/70 active:text-white'
                    }`}
                  >
                    {isRussian ? 'Видео' : 'Video'}
                  </button>
                </div>
              </div>

              {/* Capture button - iOS style */}
              <div className="flex justify-center">
                <button
                  onClick={mode === 'photo' ? takePhoto : toggleRecording}
                  disabled={isInitializing || !!error}
                  className="relative group disabled:opacity-50"
                >
                  {/* Outer ring */}
                  <div
                    className={`w-20 h-20 rounded-full border-4 transition-colors ${
                      isRecording ? 'border-red-500' : 'border-white'
                    }`}
                  />

                  {/* Inner button */}
                  <div
                    className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all ${
                      mode === 'photo'
                        ? 'w-16 h-16 rounded-full bg-white group-active:scale-90'
                        : isRecording
                        ? 'w-8 h-8 rounded-md bg-red-500'
                        : 'w-16 h-16 rounded-full bg-red-500 group-active:scale-90'
                    }`}
                  />
                </button>
              </div>

              {/* Mode icon hints */}
              <div className="flex justify-center mt-4 gap-8">
                <div className="flex items-center gap-1.5 text-white/50">
                  <Camera className="w-4 h-4" />
                  <span className="text-xs">{isRussian ? 'Фото' : 'Photo'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-white/50">
                  <Video className="w-4 h-4" />
                  <span className="text-xs">{isRussian ? 'Видео' : 'Video'}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
