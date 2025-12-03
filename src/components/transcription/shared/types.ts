/**
 * TypeScript type definitions for Lameta Transcription Tools
 * Based on SayMore annotation model and Prestige multi-track playback
 */

// ============================================================================
// Core Annotation Types
// ============================================================================

/**
 * Represents a single time-bounded annotation segment
 * Inspired by SayMore's AnnotationSegment.cs
 */
export interface AnnotationSegment {
  /** Unique identifier for this segment */
  id: string;

  /** Start time in seconds */
  start: number;

  /** End time in seconds */
  end: number;

  /** Transcription text in source language */
  text: string;

  /** Free translation text */
  translation?: string;

  /** Path to careful speech audio file (oral annotation) */
  carefulSpeechFile?: string;

  /** Path to oral translation audio file */
  oralTranslationFile?: string;

  /** Whether this segment is currently selected */
  selected?: boolean;
}

/**
 * Type of oral annotation
 */
export enum OralAnnotationType {
  CarefulSpeech = "careful",
  Translation = "translation",
}

// ============================================================================
// Audio Track Types (for Preview Tab)
// ============================================================================

/**
 * Segment audio file information (for annotation tracks)
 */
export interface SegmentAudioFile {
  path: string;
  start: number;
  end: number;
  duration: number;
}

/**
 * Audio track configuration for multi-layer playback
 * Based on Prestige's DeeJay component
 */
export interface AudioTrack {
  /** Unique identifier for this track */
  id: string;

  /** Display label for the track */
  label: string;

  /** Audio file URL or path */
  url: string;

  /** Volume (0-100) */
  volume: number;

  /** Whether the track is muted */
  muted: boolean;

  /** Whether this track is a "king" (volume >= 84%) or "prince" */
  isKing: boolean;

  /** Optional: segment files metadata (for merged annotation tracks) */
  segmentFiles?: SegmentAudioFile[];
}

/**
 * Kings and Princes categorization
 * From Prestige ExportVid: kings play at normal speed, princes at adjusted speed
 */
export interface KingsPrincesConfig {
  /** Indices of tracks that are kings (volume >= 84%) */
  kingIndices: number[];

  /** Indices of tracks that are princes (volume < 84%, > silent) */
  princeIndices: number[];

  /** Silent volume threshold */
  silentThreshold: number;

  /** King volume threshold (0.5 ** 0.25 ≈ 0.84) */
  kingThreshold: number;
}

// ============================================================================
// Playback State
// ============================================================================

/**
 * Playback control state
 */
export interface PlaybackState {
  /** Whether media is currently playing */
  playing: boolean;

  /** Current playback time in seconds */
  currentTime: number;

  /** Total duration in seconds */
  duration: number;

  /** Playback rate (0.2 - 15.0, where 1.0 is normal speed) */
  playbackRate: number;

  /** Whether playback is looping */
  loop: boolean;

  /** Loop region (if set) */
  loopRegion?: {
    start: number;
    end: number;
  };

  /** Volume (0-1) */
  volume: number;

  /** Whether audio is muted */
  muted: boolean;
}

// ============================================================================
// Segmentation Configuration
// ============================================================================

/**
 * Auto-segmentation settings
 * Based on SayMore's AutoSegmenter parameters
 */
export interface SegmentationSettings {
  /** Minimum segment length in milliseconds (default: 500) */
  minimumSegmentLengthMs: number;

  /** Maximum segment length in milliseconds (default: 10000) */
  maximumSegmentLengthMs: number;

  /** Preferred pause length in milliseconds (default: 300) */
  preferredPauseLengthMs: number;

  /** Optimum length clamping factor (default: 0.85) */
  optimumLengthClampingFactor: number;

  /** Silence threshold in dB (default: -40) */
  silenceThresholdDb: number;
}

// ============================================================================
// Main Transcription State
// ============================================================================

/**
 * Main state interface for transcription view
 * Manages segments, playback, and UI state
 */
export interface TranscriptionState {
  /** Path to the source media file */
  mediaFilePath: string;

  /** Path to the ELAN .eaf file (if exists) */
  eafFilePath?: string;

  /** Array of annotation segments */
  segments: AnnotationSegment[];

  /** Currently selected segment ID */
  selectedSegmentId?: string;

  /** Playback state */
  playback: PlaybackState;

  /** Audio tracks for multi-layer playback (Preview tab) */
  audioTracks: AudioTrack[];

  /** Segmentation settings */
  segmentationSettings: SegmentationSettings;

  /** Whether auto-save is enabled */
  autoSaveEnabled: boolean;

  /** Whether the file has unsaved changes */
  hasUnsavedChanges: boolean;

  /** Whether segmentation is in progress */
  isSegmenting: boolean;

  /** Whether export is in progress */
  isExporting: boolean;
}

// ============================================================================
// Action Types (for state management)
// ============================================================================

/**
 * Actions for modifying transcription state
 */
export type TranscriptionAction =
  | { type: "SET_SEGMENTS"; payload: AnnotationSegment[] }
  | { type: "ADD_SEGMENT"; payload: AnnotationSegment }
  | { type: "UPDATE_SEGMENT"; payload: { id: string; changes: Partial<AnnotationSegment> } }
  | { type: "DELETE_SEGMENT"; payload: string }
  | { type: "SELECT_SEGMENT"; payload: string | undefined }
  | { type: "SET_PLAYBACK_TIME"; payload: number }
  | { type: "TOGGLE_PLAY" }
  | { type: "SET_PLAYBACK_RATE"; payload: number }
  | { type: "SET_LOOP_REGION"; payload: { start: number; end: number } | undefined }
  | { type: "CLEAR_LOOP_REGION" }
  | { type: "UPDATE_TRACK_VOLUME"; payload: { trackId: string; volume: number } }
  | { type: "TOGGLE_TRACK_MUTE"; payload: string }
  | { type: "SET_SEGMENTATION_SETTINGS"; payload: Partial<SegmentationSettings> }
  | { type: "START_SEGMENTATION" }
  | { type: "COMPLETE_SEGMENTATION"; payload: AnnotationSegment[] }
  | { type: "MARK_SAVED" }
  | { type: "MARK_UNSAVED" };

// ============================================================================
// Export Configuration
// ============================================================================

/**
 * Video export settings
 * Based on Prestige's ExportVid component
 */
export interface ExportSettings {
  /** Output file path */
  outputPath: string;

  /** Whether to include video (false = audio-only) */
  includeVideo: boolean;

  /** Whether to burn subtitles into video */
  burnSubtitles: boolean;

  /** Subtitle style settings */
  subtitleStyle?: {
    fontName: string;
    fontSize: number;
    primaryColor: string;
    outlineColor: string;
    bold: boolean;
  };

  /** Format (mp4, mov, wav, mp3) */
  format: "mp4" | "mov" | "wav" | "mp3";

  /** Video codec (if video) */
  videoCodec?: string;

  /** Audio codec */
  audioCodec?: string;

  /** Whether to apply kings/princes speed adjustment */
  applyKingsPrinces: boolean;

  /** Global speed multiplier for export (default: 1.0) */
  multiplier?: number;
}

// ============================================================================
// Component Props Interfaces
// ============================================================================

/**
 * Props for TranscriptionView component
 */
export interface TranscriptionViewProps {
  /** Path to the media file to transcribe */
  mediaFilePath: string;

  /** Optional path to existing ELAN file */
  eafFilePath?: string;

  /** Callback when transcription is closed */
  onClose: () => void;

  /** Display mode: 'annotate' for annotation grid, 'segment' for segmentation tools only, 'preview' for multi-track playback */
  mode?: "annotate" | "segment" | "preview";
}

/**
 * Props for VideoPlayerSection component
 */
export interface VideoPlayerSectionProps {
  /** Media URL or path */
  url: string;

  /** Playback state */
  playback: PlaybackState;

  /** Callback when playback time changes */
  onProgress: (time: number) => void;

  /** Callback when duration is loaded */
  onDuration: (duration: number) => void;

  /** Callback when play/pause changes */
  onPlayPause: (playing: boolean) => void;

  /** Optional className for styling */
  className?: string;
}

/**
 * Props for PlaybackControls component
 */
export interface PlaybackControlsProps {
  /** Playback state */
  playback: PlaybackState;

  /** Callback to toggle play/pause */
  onTogglePlay: () => void;

  /** Callback to change playback rate */
  onPlaybackRateChange: (rate: number) => void;

  /** Callback to toggle loop */
  onToggleLoop: () => void;

  /** Callback to seek to specific time */
  onSeek: (time: number) => void;

  /** Optional className for styling */
  className?: string;
}

/**
 * Props for WaveformSection component
 */
export interface WaveformSectionProps {
  /** Audio URL or path */
  audioUrl: string;

  /** Annotation segments to display as regions */
  segments: AnnotationSegment[];

  /** Currently selected segment ID */
  selectedSegmentId?: string;

  /** Current playback time */
  currentTime: number;

  /** Callback when a segment region is clicked */
  onSegmentClick: (segmentId: string) => void;

  /** Callback when a segment boundary is adjusted */
  onSegmentBoundaryChange: (segmentId: string, newStart: number, newEnd: number) => void;

  /** Optional className for styling */
  className?: string;
}

/**
 * Props for AnnotationGrid component
 */
export interface AnnotationGridProps {
  /** Annotation segments */
  segments: AnnotationSegment[];

  /** Currently selected segment ID */
  selectedSegmentId?: string;

  /** Whether grid is editable */
  editable: boolean;

  /** Callback when a segment is selected */
  onSegmentSelect: (segmentId: string) => void;

  /** Callback when segment text is edited */
  onSegmentEdit: (segmentId: string, field: keyof AnnotationSegment, value: string) => void;

  /** Callback when segment is double-clicked (should play) */
  onSegmentPlay: (segmentId: string) => void;

  /** Optional className for styling */
  className?: string;
}
