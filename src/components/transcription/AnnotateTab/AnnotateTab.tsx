/**
 * AnnotateTab - SayMore-inspired transcription interface
 * Provides video playback, waveform, segmentation tools, and annotation grid
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import "./AnnotateTab.css";
import VideoPlayerSection from "../shared/VideoPlayerSection";
import WaveformSection from "../shared/WaveformSection";
import useKeyboardShortcuts from "../shared/useKeyboardShortcuts";
import RecordingDialog from "../shared/RecordingDialog";
import {
  AnnotationSegment,
  PlaybackState,
  OralAnnotationType,
} from "../shared/types";

const path = require("path");
const fs = require("fs");

/**
 * Find the audio file to use for waveform display
 * For video files, looks for the StandardAudio.wav file in the same directory
 */
function getAudioUrlForWaveform(mediaFilePath: string): string {
  const ext = path.extname(mediaFilePath).toLowerCase();

  // If it's already an audio file, use it directly
  if (ext === ".wav" || ext === ".mp3" || ext === ".ogg" || ext === ".flac") {
    return mediaFilePath;
  }

  // For video files, look for StandardAudio.wav
  const mediaDir = path.dirname(mediaFilePath);
  const mediaBaseName = path.basename(mediaFilePath, ext);

  // Try to find StandardAudio.wav or similar
  const audioPatterns = [
    path.join(mediaDir, `${mediaBaseName}_StandardAudio.wav`),
    path.join(mediaDir, `${mediaBaseName} StandardAudio.wav`),
    path.join(mediaDir, `${mediaBaseName}.wav`),
  ];

  for (const audioPath of audioPatterns) {
    if (fs.existsSync(audioPath)) {
      console.log(`Using audio file for waveform: ${audioPath}`);
      return audioPath;
    }
  }

  // Fallback: return the video file (may not work with WaveSurfer)
  console.warn(`No audio file found for ${mediaFilePath}, using video file (may not display waveform)`);
  return mediaFilePath;
}

/**
 * Get the base audio file path for determining annotations directory
 * This matches the audio file used for the waveform, not the video file
 */
function getBaseAudioFileForAnnotations(mediaFilePath: string): string {
  const ext = path.extname(mediaFilePath).toLowerCase();

  // If it's already an audio file, use it directly
  if (ext === ".wav" || ext === ".mp3" || ext === ".ogg" || ext === ".flac") {
    return mediaFilePath;
  }

  // For video files, look for StandardAudio.wav (same logic as getAudioUrlForWaveform)
  const mediaDir = path.dirname(mediaFilePath);
  const mediaBaseName = path.basename(mediaFilePath, ext);

  // Try to find StandardAudio.wav or similar
  const audioPatterns = [
    path.join(mediaDir, `${mediaBaseName}_StandardAudio.wav`),
    path.join(mediaDir, `${mediaBaseName} StandardAudio.wav`),
    path.join(mediaDir, `${mediaBaseName}.wav`),
  ];

  for (const audioPath of audioPatterns) {
    if (fs.existsSync(audioPath)) {
      return audioPath;
    }
  }

  // Fallback: return the video file (may not work with WaveSurfer)
  console.warn(`No audio file found for ${mediaFilePath}, using video file (may not display waveform)`);
  return mediaFilePath;
}

/**
 * Props for AnnotateTab component
 */
interface AnnotateTabProps {
  mediaFilePath: string;
  segments: AnnotationSegment[];
  selectedSegmentId?: string;
  playback: PlaybackState;
  isSegmenting: boolean;

  onSegmentSelect: (segmentId: string | undefined) => void;
  onSegmentUpdate: (segmentId: string, field: keyof AnnotationSegment, value: string) => void;
  onSegmentBoundaryChange: (segmentId: string, newStart: number, newEnd: number) => void;
  onTogglePlay: () => void;
  onProgress: (currentTime: number) => void;
  onDuration: (duration: number) => void;
  onPlaybackRateChange: (playbackRate: number) => void;
  onPlaybackChange: (changes: Partial<PlaybackState>) => void;
  onStartSegmentation: () => void;
  onAddSegment: () => void;
  onDeleteSegment: () => void;
  onSplitSegment: () => void;
  onMergeSegments: () => void;
  onSave: () => void;
  onSaveRecording: (segmentId: string, recordingType: OralAnnotationType, audioBlob: Blob) => void;
  mode?: "segment" | "annotate";
}

/**
 * AnnotateTab Component
 */
export const AnnotateTab: React.FC<AnnotateTabProps> = ({
  mediaFilePath,
  segments,
  selectedSegmentId,
  playback,
  isSegmenting,
  onSegmentSelect,
  onSegmentUpdate,
  onSegmentBoundaryChange,
  onTogglePlay,
  onProgress,
  onDuration,
  onPlaybackRateChange,
  onPlaybackChange,
  onStartSegmentation,
  onAddSegment,
  onDeleteSegment,
  onSplitSegment,
  onMergeSegments,
  onSave,
  onSaveRecording,
  mode = "annotate",
}) => {
  // Memoize audio URL to prevent re-initialization of WaveSurfer
  const audioUrl = useMemo(() => getAudioUrlForWaveform(mediaFilePath), [mediaFilePath]);

  // Track mounted state and active timeouts to prevent memory leaks
  const isMountedRef = useRef(true);
  const activeTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const annotationAudioRef = useRef<HTMLAudioElement | null>(null);

  // Recording dialog state
  const [recordingDialog, setRecordingDialog] = useState<{
    isOpen: boolean;
    segmentId: string;
    recordingType: OralAnnotationType;
  }>({
    isOpen: false,
    segmentId: "",
    recordingType: OralAnnotationType.CarefulSpeech,
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Clear all active timeouts
      activeTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      activeTimeoutsRef.current.clear();
      // Stop and cleanup annotation audio if playing
      if (annotationAudioRef.current) {
        annotationAudioRef.current.pause();
        annotationAudioRef.current = null;
      }
    };
  }, []);

  /**
   * Auto-resize textarea to fit content
   */
  const handleTextareaResize = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = element.scrollHeight + 'px';
  };

  /**
   * Auto-resize all textareas when segments change
   */
  useEffect(() => {
    const textareas = document.querySelectorAll('.annotation-grid textarea');
    textareas.forEach((textarea) => {
      handleTextareaResize(textarea as HTMLTextAreaElement);
    });
  }, [segments]);

  /**
   * Handle segment click from waveform
   */
  const handleSegmentClick = (segmentId: string) => {
    onSegmentSelect(segmentId);
  };

  /**
   * Open recording dialog
   */
  const handleOpenRecording = (segmentId: string, recordingType: OralAnnotationType) => {
    setRecordingDialog({
      isOpen: true,
      segmentId,
      recordingType,
    });
  };

  /**
   * Close recording dialog
   */
  const handleCloseRecording = () => {
    setRecordingDialog({
      isOpen: false,
      segmentId: "",
      recordingType: OralAnnotationType.CarefulSpeech,
    });
  };

  /**
   * Handle segment play (double-click or F2 key)
   */
  const handleSegmentPlay = (segmentId?: string) => {
    const targetId = segmentId || selectedSegmentId;
    if (!targetId) return;

    const segment = segments.find((s) => s.id === targetId);
    if (segment) {
      // Seek to segment start
      onProgress(segment.start);
      // Play if not already playing
      if (!playback.playing) {
        onTogglePlay();
      }
      console.log(`Playing segment: ${targetId} (${segment.start}s - ${segment.end}s)`);
    }
  };

  /**
   * Handle transcription field focus - play segment 5 times for transcription
   * Plays Careful speech annotation if it exists, otherwise plays original segment
   */
  const handleTranscriptionFocus = (segmentId: string) => {
    const segment = segments.find((s) => s.id === segmentId);
    if (!segment) return;

    // Select the segment (but ensure video doesn't auto-play)
    onSegmentSelect(segmentId);

    // Stop any video playback immediately
    if (playback.playing) {
      onTogglePlay();
    }

    // Get the base audio file (StandardAudio.wav) to determine annotations directory
    // This is important because the annotations are associated with the audio file, not the video file
    const baseAudioFile = getBaseAudioFileForAnnotations(mediaFilePath);
    const audioDir = path.dirname(baseAudioFile);

    // Try to find the annotations directory - SayMore uses the full audio filename
    // May have encoding variations (e.g., é vs e) so we need to check what actually exists
    const audioBaseName = path.basename(baseAudioFile);
    let annotationsDir = path.join(audioDir, `${audioBaseName}_Annotations`);

    // If that doesn't exist, try listing directories to find the actual name
    if (!fs.existsSync(annotationsDir)) {
      const files = fs.readdirSync(audioDir);
      const annotationsDirs = files.filter((f: string) =>
        f.includes('_Annotations') &&
        f.toLowerCase().includes('standardaudio')
      );
      if (annotationsDirs.length > 0) {
        annotationsDir = path.join(audioDir, annotationsDirs[0]);
        console.log(`  Found annotations dir via search: ${annotationsDir}`);
      }
    }

    const carefulFileName = `${segment.start}_to_${segment.end}_Careful.wav`;
    const carefulFilePath = path.join(annotationsDir, carefulFileName);

    console.log(`[Transcription Focus] Checking for Careful annotation:`);
    console.log(`  mediaFilePath: ${mediaFilePath}`);
    console.log(`  baseAudioFile: ${baseAudioFile}`);
    console.log(`  audioDir: ${audioDir}`);
    console.log(`  audioBaseName: ${audioBaseName}`);
    console.log(`  annotationsDir: ${annotationsDir}`);
    console.log(`  carefulFileName: ${carefulFileName}`);
    console.log(`  carefulFilePath: ${carefulFilePath}`);
    console.log(`  segment: ${segment.start} to ${segment.end}`);

    // List files in annotations directory for debugging
    if (fs.existsSync(annotationsDir)) {
      const files = fs.readdirSync(annotationsDir);
      console.log(`  Files in annotations folder (${files.length} files):`, files);
    } else {
      console.log(`  Annotations directory does not exist`);
    }

    const isCarefulAnnotation = fs.existsSync(carefulFilePath);
    console.log(`  exists: ${isCarefulAnnotation}`);

    if (isCarefulAnnotation) {
      console.log(`Playing Careful speech annotation: ${carefulFilePath}`);
    } else {
      console.log(`No Careful speech annotation found, playing original segment`);
    }

    // Play the audio 5 times with synchronized video
    let playCount = 0;
    const maxPlays = 5;

    const playSegment = () => {
      if (!isMountedRef.current || playCount >= maxPlays) {
        if (playCount >= maxPlays) {
          console.log(`Finished playing segment ${maxPlays} times`);
        }
        return;
      }

      playCount++;
      console.log(`Playing segment (${playCount}/${maxPlays})`);

      if (isCarefulAnnotation) {
        // Play the Careful speech annotation audio file at user-selected speed
        const audioUrl = `file://${carefulFilePath.replace(/\\/g, '/')}`;
        console.log(`  audioUrl: ${audioUrl}`);
        console.log(`  playback rate: ${playback.playbackRate}x`);

        if (!annotationAudioRef.current) {
          annotationAudioRef.current = new Audio(audioUrl);
        } else {
          annotationAudioRef.current.src = audioUrl;
        }

        // Set audio playback rate to match user's selected speed
        annotationAudioRef.current.playbackRate = playback.playbackRate;
        annotationAudioRef.current.currentTime = 0;

        // Load metadata to get annotation audio duration
        annotationAudioRef.current.onloadedmetadata = () => {
          if (!annotationAudioRef.current || !isMountedRef.current) return;

          const annotationDuration = annotationAudioRef.current.duration;
          const segmentDuration = segment.end - segment.start;
          const baseRate = playback.playbackRate;

          // Calculate video speed to sync with annotation
          const videoSpeed = segmentDuration / (annotationDuration / baseRate);

          console.log(`  Segment duration: ${segmentDuration.toFixed(3)}s`);
          console.log(`  Annotation duration: ${annotationDuration.toFixed(3)}s`);
          console.log(`  Calculated video speed: ${videoSpeed.toFixed(3)}x`);

          // Seek video to segment start
          onProgress(segment.start);

          // Update video playback rate
          onPlaybackRateChange(videoSpeed);

          // Start video on first play only
          if (playCount === 1 && !playback.playing) {
            onTogglePlay();
          }
        };

        // Play annotation audio
        annotationAudioRef.current.play().catch((err) => {
          console.error("Error playing annotation audio:", err);
        });

        // When audio ends, continue playing or finish
        annotationAudioRef.current.onended = () => {
          if (isMountedRef.current) {
            console.log(`Audio ended. playCount=${playCount}, maxPlays=${maxPlays}`);
            if (playCount < maxPlays) {
              // Continue to next iteration - video stays playing
              console.log(`  -> Continuing to next iteration`);
              const timeout = setTimeout(playSegment, 100);
              activeTimeoutsRef.current.add(timeout);
            } else {
              // Finished all plays
              console.log(`  -> All plays finished`);
              console.log(`  -> Video playing state: ${playback.playing}`);

              // Stop video and disable looping
              if (playback.playing) {
                console.log(`  -> Stopping video`);
                onTogglePlay();
              }

              // Disable loop to prevent video from continuing to loop
              console.log(`  -> Disabling loop`);
              onPlaybackChange({ loop: false });

              console.log(`Finished playing segment ${maxPlays} times`);
            }
          }
        };
      } else {
        // Play original segment from video (with audio)
        onProgress(segment.start);
        if (!playback.playing) {
          onTogglePlay();
        }

        // Wait for segment duration, then play again or finish
        const segmentDuration = (segment.end - segment.start) * 1000;
        const timeout = setTimeout(() => {
          if (playCount >= maxPlays) {
            // Finished all plays
            console.log(`Finished playing segment ${maxPlays} times (original)`);
            if (playback.playing) {
              onTogglePlay();
            }
            // Disable loop
            onPlaybackChange({ loop: false });
          } else {
            // Continue to next iteration
            playSegment();
          }
        }, segmentDuration);
        activeTimeoutsRef.current.add(timeout);
      }
    };

    // Start playing
    playSegment();
  };

  /**
   * Handle translation field focus - play segment 5 times for translation
   * Priority: Translation annotation > Careful speech > Original segment
   */
  const handleTranslationFocus = (segmentId: string) => {
    const segment = segments.find((s) => s.id === segmentId);
    if (!segment) return;

    // Select the segment (but ensure video doesn't auto-play)
    onSegmentSelect(segmentId);

    // Stop any video playback immediately
    if (playback.playing) {
      onTogglePlay();
    }

    // Get the base audio file (StandardAudio.wav) to determine annotations directory
    // This is important because the annotations are associated with the audio file, not the video file
    const baseAudioFile = getBaseAudioFileForAnnotations(mediaFilePath);
    const audioDir = path.dirname(baseAudioFile);

    // Try to find the annotations directory - SayMore uses the full audio filename
    // May have encoding variations (e.g., é vs e) so we need to check what actually exists
    const audioBaseName = path.basename(baseAudioFile);
    let annotationsDir = path.join(audioDir, `${audioBaseName}_Annotations`);

    // If that doesn't exist, try listing directories to find the actual name
    if (!fs.existsSync(annotationsDir)) {
      const files = fs.readdirSync(audioDir);
      const annotationsDirs = files.filter((f: string) =>
        f.includes('_Annotations') &&
        f.toLowerCase().includes('standardaudio')
      );
      if (annotationsDirs.length > 0) {
        annotationsDir = path.join(audioDir, annotationsDirs[0]);
        console.log(`  Found annotations dir via search: ${annotationsDir}`);
      }
    }

    const translationFileName = `${segment.start}_to_${segment.end}_Translation.wav`;
    const translationFilePath = path.join(annotationsDir, translationFileName);

    const carefulFileName = `${segment.start}_to_${segment.end}_Careful.wav`;
    const carefulFilePath = path.join(annotationsDir, carefulFileName);

    let audioSource: "translation" | "careful" | "original" = "original";
    let audioFilePath = "";

    // Check in priority order: Translation > Careful > Original
    if (fs.existsSync(translationFilePath)) {
      audioSource = "translation";
      audioFilePath = translationFilePath;
      console.log(`Playing Translation annotation: ${translationFilePath}`);
    } else if (fs.existsSync(carefulFilePath)) {
      audioSource = "careful";
      audioFilePath = carefulFilePath;
      console.log(`Playing Careful speech annotation (fallback): ${carefulFilePath}`);
    } else {
      console.log(`No annotations found, playing original segment`);
    }

    // Play the audio 5 times with synchronized video
    let playCount = 0;
    const maxPlays = 5;

    const playSegment = () => {
      if (!isMountedRef.current || playCount >= maxPlays) {
        if (playCount >= maxPlays) {
          console.log(`Finished playing segment ${maxPlays} times (source: ${audioSource})`);
        }
        return;
      }

      playCount++;
      console.log(`Playing segment (${playCount}/${maxPlays}) - source: ${audioSource}`);

      if (audioSource !== "original") {
        // Play the annotation audio file (Translation or Careful) at user-selected speed
        const audioUrl = `file://${audioFilePath.replace(/\\/g, '/')}`;
        console.log(`  audioUrl: ${audioUrl}`);
        console.log(`  playback rate: ${playback.playbackRate}x`);

        if (!annotationAudioRef.current) {
          annotationAudioRef.current = new Audio(audioUrl);
        } else {
          annotationAudioRef.current.src = audioUrl;
        }

        // Set audio playback rate to match user's selected speed
        annotationAudioRef.current.playbackRate = playback.playbackRate;
        annotationAudioRef.current.currentTime = 0;

        // Load metadata to get annotation audio duration
        annotationAudioRef.current.onloadedmetadata = () => {
          if (!annotationAudioRef.current || !isMountedRef.current) return;

          const annotationDuration = annotationAudioRef.current.duration; // Natural duration of annotation file
          const segmentDuration = segment.end - segment.start; // Video segment duration
          const baseRate = playback.playbackRate; // User's selected playback speed

          // Calculate video speed: video must cover segmentDuration in the time it takes to play annotation
          // Time to play annotation = annotationDuration / baseRate
          // Video speed = segmentDuration / (annotationDuration / baseRate)
          const videoSpeed = segmentDuration / (annotationDuration / baseRate);

          console.log(`  Segment duration: ${segmentDuration.toFixed(3)}s`);
          console.log(`  Annotation duration: ${annotationDuration.toFixed(3)}s`);
          console.log(`  Calculated video speed: ${videoSpeed.toFixed(3)}x`);

          // Seek video to segment start
          onProgress(segment.start);

          // Update video playback rate
          onPlaybackRateChange(videoSpeed);

          // Start video on first play only
          if (playCount === 1 && !playback.playing) {
            onTogglePlay();
          }
        };

        // Play annotation audio
        annotationAudioRef.current.play().catch((err) => {
          console.error("Error playing annotation audio:", err);
        });

        // When audio ends, continue playing or finish
        annotationAudioRef.current.onended = () => {
          if (isMountedRef.current) {
            console.log(`Audio ended. playCount=${playCount}, maxPlays=${maxPlays}`);
            if (playCount < maxPlays) {
              // Continue to next iteration - video stays playing
              console.log(`  -> Continuing to next iteration`);
              const timeout = setTimeout(playSegment, 100);
              activeTimeoutsRef.current.add(timeout);
            } else {
              // Finished all plays
              console.log(`  -> All plays finished`);
              console.log(`  -> Video playing state: ${playback.playing}`);

              // Stop video and disable looping to prevent VideoPlayerSection from continuing
              if (playback.playing) {
                console.log(`  -> Stopping video`);
                onTogglePlay();
              }

              // Disable loop to prevent video from continuing to loop
              console.log(`  -> Disabling loop`);
              onPlaybackChange({ loop: false });

              console.log(`Finished playing segment ${maxPlays} times (source: ${audioSource})`);
            }
          }
        };
      } else {
        // Play original segment from video (with audio)
        onProgress(segment.start);
        if (!playback.playing) {
          onTogglePlay();
        }

        // Wait for segment duration, then play again
        const timeout = setTimeout(playSegment, (segment.end - segment.start) * 1000);
        activeTimeoutsRef.current.add(timeout);
      }
    };

    // Start playing
    playSegment();
  };

  /**
   * Navigate to next segment
   */
  const handleNextSegment = () => {
    if (!selectedSegmentId || segments.length === 0) {
      // Select first segment if none selected
      if (segments.length > 0) {
        onSegmentSelect(segments[0].id);
      }
      return;
    }

    const currentIndex = segments.findIndex((s) => s.id === selectedSegmentId);
    if (currentIndex < segments.length - 1) {
      onSegmentSelect(segments[currentIndex + 1].id);
    }
  };

  /**
   * Navigate to previous segment
   */
  const handlePreviousSegment = () => {
    if (!selectedSegmentId || segments.length === 0) return;

    const currentIndex = segments.findIndex((s) => s.id === selectedSegmentId);
    if (currentIndex > 0) {
      onSegmentSelect(segments[currentIndex - 1].id);
    }
  };

  /**
   * Enable keyboard shortcuts
   */
  useKeyboardShortcuts({
    enabled: true,
    onPlayPause: onTogglePlay,
    onPlaySegment: () => handleSegmentPlay(),
    onSave: onSave,
    onAddSegment: onAddSegment,
    onDeleteSegment: onDeleteSegment,
    onSplitSegment: onSplitSegment,
    onMergeSegments: onMergeSegments,
    onNextSegment: handleNextSegment,
    onPreviousSegment: handlePreviousSegment,
    onAutoSegment: onStartSegmentation,
  });

  return (
    <div className="annotate-tab">
      {/* Video Player Section */}
      <div className="video-section">
        <VideoPlayerSection
          url={mediaFilePath}
          playback={mode === "annotate" ? { ...playback, muted: true } : playback}
          onProgress={onProgress}
          onDuration={onDuration}
          onPlayPause={onTogglePlay}
        />
      </div>

      {/* Segmentation Toolbar - only show in segment mode */}
      {mode === "segment" && (
      <div className="segmentation-toolbar">
        <button
          onClick={onStartSegmentation}
          disabled={isSegmenting}
          className="btn-segment"
          title="Auto-segment audio (Ctrl+Shift+A)"
        >
          {isSegmenting ? "Segmenting..." : "Auto-Segment"}
        </button>
        <button onClick={onAddSegment} className="btn-add-segment" title="Add new segment (Ctrl+N)">
          Add Segment
        </button>
        <button
          onClick={onDeleteSegment}
          disabled={!selectedSegmentId}
          className="btn-delete-segment"
          title="Delete selected segment (Ctrl+D)"
        >
          Delete Segment
        </button>
        <button
          onClick={onSplitSegment}
          disabled={!selectedSegmentId}
          className="btn-split-segment"
          title="Split segment at current time (Ctrl+T)"
        >
          Split Segment
        </button>
        <button
          onClick={onMergeSegments}
          disabled={!selectedSegmentId}
          className="btn-merge-segments"
          title="Merge with next segment (Ctrl+M)"
        >
          Merge Segments
        </button>
        <div className="keyboard-shortcuts-hint" style={{ marginLeft: "auto", fontSize: "0.85em", color: "#666" }}>
          Shortcuts: Space=Play/Pause | F2=Play segment | Tab=Next | Ctrl+S=Save
        </div>
        <button
          onClick={onSave}
          className="btn-save"
          title="Save changes (Ctrl+S)"
        >
          Save
        </button>
      </div>
      )}

      {/* Waveform Section - only show in segment mode */}
      {mode === "segment" && (
      <div className="waveform-wrapper">
        <WaveformSection
          audioUrl={audioUrl}
          segments={segments}
          selectedSegmentId={selectedSegmentId}
          currentTime={playback.currentTime}
          onSegmentClick={handleSegmentClick}
          onSegmentBoundaryChange={onSegmentBoundaryChange}
        />
      </div>
      )}

      {/* Annotation Grid Section - only show in annotate mode */}
      {mode === "annotate" && (
      <div className="annotation-grid-section">
        <table className="annotation-grid">
          <thead>
            <tr>
              <th style={{ width: "80px" }}>Start</th>
              <th style={{ width: "80px" }}>End</th>
              <th style={{ width: "80px" }}>Length</th>
              <th>Transcription</th>
              <th>Translation</th>
              <th style={{ width: "60px" }}>Audio</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((segment) => (
              <tr
                key={segment.id}
                className={segment.id === selectedSegmentId ? "selected" : ""}
                onClick={() => handleSegmentClick(segment.id)}
                onDoubleClick={() => handleSegmentPlay(segment.id)}
              >
                <td>{segment.start.toFixed(2)}</td>
                <td>{segment.end.toFixed(2)}</td>
                <td>{(segment.end - segment.start).toFixed(2)}</td>
                <td>
                  <textarea
                    value={segment.text}
                    onChange={(e) => {
                      onSegmentUpdate(segment.id, "text", e.target.value);
                    }}
                    onInput={(e) => handleTextareaResize(e.currentTarget)}
                    onFocus={() => handleTranscriptionFocus(segment.id)}
                    placeholder="Enter transcription..."
                    rows={1}
                    style={{ width: "100%", resize: "vertical", overflow: "hidden", minHeight: "24px" }}
                  />
                </td>
                <td>
                  <textarea
                    value={segment.translation || ""}
                    onChange={(e) => {
                      onSegmentUpdate(segment.id, "translation", e.target.value);
                    }}
                    onInput={(e) => handleTextareaResize(e.currentTarget)}
                    onFocus={() => handleTranslationFocus(segment.id)}
                    placeholder="Enter translation..."
                    rows={1}
                    style={{ width: "100%", resize: "vertical", overflow: "hidden", minHeight: "24px" }}
                  />
                </td>
                <td className="audio-buttons">
                  <button
                    className="btn-record"
                    title="Record careful speech"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenRecording(segment.id, OralAnnotationType.CarefulSpeech);
                    }}
                  >
                    🎤
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {/* Playback Controls */}
      <div className="playback-controls">
        <button onClick={onTogglePlay}>
          {playback.playing ? "⏸ Pause" : "▶ Play"}
        </button>
        <span className="time-display">
          {playback.currentTime.toFixed(1)}s / {playback.duration.toFixed(1)}s
        </span>
        {playback.loop && playback.loopRegion && (
          <span className="loop-indicator" title="Auto-looping selected segment">
            🔁 Loop: {playback.loopRegion.start.toFixed(1)}s - {playback.loopRegion.end.toFixed(1)}s
          </span>
        )}
        <label>
          Speed:
          <select
            value={playback.playbackRate}
            onChange={(e) => onPlaybackRateChange(parseFloat(e.target.value))}
          >
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1.0">1.0x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
          </select>
        </label>
      </div>

      {/* Recording Dialog */}
      <RecordingDialog
        segmentId={recordingDialog.segmentId}
        segmentText={
          segments.find((s) => s.id === recordingDialog.segmentId)?.text || ""
        }
        segmentStart={
          segments.find((s) => s.id === recordingDialog.segmentId)?.start || 0
        }
        segmentEnd={
          segments.find((s) => s.id === recordingDialog.segmentId)?.end || 0
        }
        mediaFilePath={mediaFilePath}
        recordingType={recordingDialog.recordingType}
        isOpen={recordingDialog.isOpen}
        onSave={onSaveRecording}
        onClose={handleCloseRecording}
      />
    </div>
  );
};

export default AnnotateTab;
