/**
 * RecordingDialog - In-app audio recording for oral annotations
 * Records careful speech and oral translations for each segment
 * Includes video/audio playback as a prompt using Prestige's relative clip time logic
 */

import React, { useState, useRef, useEffect } from "react";
import { OralAnnotationType, PlaybackState } from "./types";
import VideoPlayerSection from "./VideoPlayerSection";
import "./RecordingDialog.css";

/**
 * Props for RecordingDialog component
 */
export interface RecordingDialogProps {
  /** Segment ID being recorded */
  segmentId: string;

  /** Segment text for reference */
  segmentText: string;

  /** Segment start time in source media */
  segmentStart: number;

  /** Segment end time in source media */
  segmentEnd: number;

  /** Source media file path */
  mediaFilePath: string;

  /** Type of recording (careful speech or translation) */
  recordingType: OralAnnotationType;

  /** Whether dialog is open */
  isOpen: boolean;

  /** Callback when recording is saved */
  onSave: (segmentId: string, recordingType: OralAnnotationType, audioBlob: Blob) => void;

  /** Callback when dialog is closed */
  onClose: () => void;
}

/**
 * RecordingDialog Component
 *
 * Provides UI for recording oral annotations using MediaRecorder API.
 * Supports careful speech and oral translation recordings.
 * Includes video playback with auto-looping segment using Prestige's relative clip time logic.
 */
export const RecordingDialog: React.FC<RecordingDialogProps> = ({
  segmentId,
  segmentText,
  segmentStart,
  segmentEnd,
  mediaFilePath,
  recordingType,
  isOpen,
  onSave,
  onClose,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Video playback state - auto-play and loop the segment
  const [playback, setPlayback] = useState<PlaybackState>({
    playing: true, // Auto-play when dialog opens
    currentTime: segmentStart,
    duration: 0,
    playbackRate: 1.0,
    volume: 0.5,
    muted: false,
    loop: true,
    loopRegion: {
      start: segmentStart,
      end: segmentEnd,
    },
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /**
   * Get recording type label
   */
  const getRecordingLabel = (): string => {
    return recordingType === OralAnnotationType.CarefulSpeech
      ? "Careful Speech"
      : "Oral Translation";
  };

  /**
   * Format recording time as MM:SS
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  /**
   * Start recording (outputs WAV format to match SayMore)
   */
  const handleStartRecording = async () => {
    try {
      setError(null);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create MediaRecorder - use webm/opus but will convert to WAV on save
      // TODO: Consider using MediaRecorder with wav encoding or Web Audio API for direct WAV output
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle recording stopped
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording:", err);
      setError("Failed to access microphone. Please check permissions.");
    }
  };

  /**
   * Pause recording
   */
  const handlePauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      setIsPaused(true);

      // Pause timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  /**
   * Resume recording
   */
  const handleResumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      setIsPaused(false);

      // Resume timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  };

  /**
   * Stop recording
   */
  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);

      // Stop timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  /**
   * Reset recording
   */
  const handleResetRecording = () => {
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setRecordingTime(0);
    audioChunksRef.current = [];
  };

  /**
   * Handle video progress updates
   */
  const handleVideoProgress = (currentTime: number) => {
    setPlayback((prev) => ({ ...prev, currentTime }));
  };

  /**
   * Handle video duration loaded
   */
  const handleVideoDuration = (duration: number) => {
    setPlayback((prev) => ({ ...prev, duration }));
  };

  /**
   * Toggle video play/pause
   */
  const handleToggleVideoPlay = () => {
    setPlayback((prev) => ({ ...prev, playing: !prev.playing }));
  };

  /**
   * Reset video playback when dialog opens
   */
  useEffect(() => {
    if (isOpen) {
      setPlayback({
        playing: true,
        currentTime: segmentStart,
        duration: 0,
        playbackRate: 1.0,
        volume: 0.5,
        muted: false,
        loop: true,
        loopRegion: {
          start: segmentStart,
          end: segmentEnd,
        },
      });
    }
  }, [isOpen, segmentStart, segmentEnd]);

  /**
   * Save recording
   */
  const handleSave = () => {
    if (audioBlob) {
      onSave(segmentId, recordingType, audioBlob);
      handleClose();
    }
  };

  /**
   * Close dialog
   */
  const handleClose = () => {
    // Cleanup
    if (isRecording) {
      handleStopRecording();
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Reset state
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsRecording(false);
    setIsPaused(false);
    setError(null);

    onClose();
  };

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [audioUrl]);

  if (!isOpen) return null;

  return (
    <div className="recording-dialog-overlay">
      <div className="recording-dialog">
        {/* Header */}
        <div className="recording-dialog-header">
          <h3>Record {getRecordingLabel()}</h3>
          <button onClick={handleClose} className="btn-close" title="Close">
            ✕
          </button>
        </div>

        {/* Segment Reference */}
        <div className="segment-reference">
          <strong>Segment Text:</strong>
          <p>{segmentText || <em>(No text)</em>}</p>
        </div>

        {/* Video Prompt Section */}
        <div className="video-prompt-section">
          <strong className="section-label">Source Segment (Auto-Loop):</strong>
          <VideoPlayerSection
            url={mediaFilePath}
            playback={playback}
            onProgress={handleVideoProgress}
            onDuration={handleVideoDuration}
            onPlayPause={handleToggleVideoPlay}
            className="recording-video-player"
          />
          <div className="video-controls">
            <button
              onClick={handleToggleVideoPlay}
              className="btn-video-control"
            >
              {playback.playing ? "⏸ Pause Video" : "▶ Play Video"}
            </button>
            <span className="segment-time-info">
              Segment: {segmentStart.toFixed(1)}s - {segmentEnd.toFixed(1)}s
              (Duration: {(segmentEnd - segmentStart).toFixed(1)}s)
            </span>
          </div>
        </div>

        {/* Error Message */}
        {error && <div className="error-message">{error}</div>}

        {/* Recording Controls */}
        <div className="recording-controls">
          {!isRecording && !audioBlob && (
            <button onClick={handleStartRecording} className="btn-start-recording">
              🎤 Start Recording
            </button>
          )}

          {isRecording && !isPaused && (
            <>
              <button onClick={handlePauseRecording} className="btn-pause-recording">
                ⏸ Pause
              </button>
              <button onClick={handleStopRecording} className="btn-stop-recording">
                ⏹ Stop
              </button>
            </>
          )}

          {isRecording && isPaused && (
            <>
              <button onClick={handleResumeRecording} className="btn-resume-recording">
                ▶ Resume
              </button>
              <button onClick={handleStopRecording} className="btn-stop-recording">
                ⏹ Stop
              </button>
            </>
          )}

          {!isRecording && audioBlob && (
            <button onClick={handleResetRecording} className="btn-reset-recording">
              🔄 Re-record
            </button>
          )}
        </div>

        {/* Recording Time */}
        {(isRecording || audioBlob) && (
          <div className="recording-time">
            <strong>Duration:</strong> {formatTime(recordingTime)}
          </div>
        )}

        {/* Recording Indicator */}
        {isRecording && (
          <div className="recording-indicator">
            <span className="recording-dot"></span>
            {isPaused ? "Paused" : "Recording..."}
          </div>
        )}

        {/* Audio Playback */}
        {audioUrl && (
          <div className="audio-playback">
            <strong>Playback:</strong>
            <audio src={audioUrl} controls />
          </div>
        )}

        {/* Action Buttons */}
        <div className="dialog-actions">
          <button onClick={handleClose} className="btn-cancel">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!audioBlob}
            className="btn-save"
          >
            Save Recording
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordingDialog;
