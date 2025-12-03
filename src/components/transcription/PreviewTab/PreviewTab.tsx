/**
 * PreviewTab - Prestige-inspired multi-layer playback and export
 * Provides synchronized playback of source, careful speech, and translation tracks
 */

import React, { useState, useEffect } from "react";
import "./PreviewTab.css";
import VideoPlayerSection from "../shared/VideoPlayerSection";
import MultiTrackWaveform, { KingsPrincesMode } from "./MultiTrackWaveform";
import ExportDialog, { ExportSettings } from "./ExportDialog";
import ExportProgressDialog, { ExportProgress } from "./ExportProgressDialog";
import { mainProcessApi } from "../../../mainProcess/MainProcessApiAccess";
import { ipcRenderer } from "electron";
import {
  AnnotationSegment,
  AudioTrack,
  PlaybackState,
} from "../shared/types";
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

/**
 * Props for PreviewTab component
 */
interface PreviewTabProps {
  mediaFilePath: string;
  segments: AnnotationSegment[];
  audioTracks: AudioTrack[];
  playback: PlaybackState;

  onTogglePlay: () => void;
  onProgress: (currentTime: number) => void;
  onDuration: (duration: number) => void;
}

/**
 * Segment audio file information for concatenation
 */
interface SegmentAudioFile {
  path: string;
  start: number; // Original segment start time
  end: number;   // Original segment end time
  duration: number; // Actual audio file duration (from file, not segment timing)
}

/**
 * Get audio file duration using ffprobe
 */
function getAudioDuration(filePath: string): number {
  try {
    // Use ffprobe to get duration
    const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    const output = execSync(command, { encoding: 'utf8' });
    const duration = parseFloat(output.trim());
    return isNaN(duration) ? 0 : duration;
  } catch (error) {
    console.error(`Failed to get duration for ${filePath}:`, error);
    return 0;
  }
}

/**
 * Normalize a name by treating spaces and underscores equivalently
 * SayMore allowed spaces in names, Lameta replaces them with underscores
 */
function normalizeNameVariants(name: string): string[] {
  // Return both space and underscore variants
  return [
    name,
    name.replace(/_/g, " "),
    name.replace(/ /g, "_")
  ];
}

/**
 * Find a file with space/underscore name variants
 */
function findFileWithNameVariants(dir: string, baseFileName: string): string | null {
  const variants = normalizeNameVariants(baseFileName);
  for (const variant of variants) {
    const filePath = path.join(dir, variant);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}

/**
 * Find any _Annotations folder in the session directory
 * Used when video/audio files share the same timing (e.g., video + extracted StandardAudio)
 */
function findAnyAnnotationsFolder(sessionDir: string): string | null {
  try {
    const entries = fs.readdirSync(sessionDir);

    // Look for any folder ending with _Annotations or " Annotations"
    for (const entry of entries) {
      const fullPath = path.join(sessionDir, entry);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory() &&
          (entry.endsWith("_Annotations") || entry.endsWith(" Annotations"))) {
        console.log(`Found annotations folder: ${fullPath}`);
        return fullPath;
      }
    }
  } catch (error) {
    console.error("Error scanning for annotations folders:", error);
  }

  return null;
}

/**
 * Find merged annotation audio file for a tier (Careful_Merged.mp3 or Translation_Merged.mp3)
 * Returns the path to the merged file if it exists, or null
 */
function findMergedAnnotationFile(
  mediaFilePath: string,
  tier: "Careful" | "Translation"
): string | null {
  const mediaDir = path.dirname(mediaFilePath);
  const mediaFileNameWithExt = path.basename(mediaFilePath);
  const mediaBaseName = path.basename(mediaFilePath, path.extname(mediaFilePath));

  // Try multiple naming patterns for the annotations folder
  const annotationsFolderPatterns = [
    `${mediaFileNameWithExt}_Annotations`,
    `${mediaBaseName}_Annotations`
  ];

  let annotationsDir: string | null = null;
  for (const pattern of annotationsFolderPatterns) {
    const found = findFileWithNameVariants(mediaDir, pattern);
    if (found) {
      annotationsDir = found;
      break;
    }
  }

  // If not found, look for any annotations folder
  if (!annotationsDir) {
    annotationsDir = findAnyAnnotationsFolder(mediaDir);
  }

  if (!annotationsDir) {
    return null;
  }

  // Look for merged file (Careful_Merged.mp3 or Translation_Merged.mp3)
  const mergedFileName = `${tier}_Merged.mp3`;
  const mergedFilePath = path.join(annotationsDir, mergedFileName);

  if (fs.existsSync(mergedFilePath)) {
    console.log(`Found merged ${tier} file: ${mergedFilePath}`);
    return mergedFilePath;
  }

  console.log(`No merged ${tier} file found at: ${mergedFilePath}`);
  return null;
}

/**
 * Discover annotation audio files for a specific tier (Careful or Translation)
 * Returns an array of segment audio files that exist in the _Annotations folder
 * Handles both space and underscore naming conventions in folder and file names
 */
function discoverAnnotationAudioFiles(
  mediaFilePath: string,
  segments: AnnotationSegment[],
  tier: "Careful" | "Translation"
): SegmentAudioFile[] {
  const mediaDir = path.dirname(mediaFilePath);
  const mediaFileNameWithExt = path.basename(mediaFilePath);
  const mediaBaseName = path.basename(mediaFilePath, path.extname(mediaFilePath));

  // Try multiple naming patterns for the annotations folder:
  // 1. {filename_with_extension}_Annotations (SayMore format)
  // 2. {filename_without_extension}_Annotations (Lameta format)
  const annotationsFolderPatterns = [
    `${mediaFileNameWithExt}_Annotations`,  // Try with extension first (SayMore)
    `${mediaBaseName}_Annotations`          // Try without extension (Lameta)
  ];

  let annotationsDir: string | null = null;
  for (const pattern of annotationsFolderPatterns) {
    const found = findFileWithNameVariants(mediaDir, pattern);
    if (found) {
      annotationsDir = found;
      break;
    }
  }

  // If not found with specific patterns, look for ANY annotations folder in the session
  // This handles cases where video uses audio file's annotations (e.g., StandardAudio.wav)
  if (!annotationsDir) {
    console.log(`No exact match found. Trying patterns:`, annotationsFolderPatterns);
    annotationsDir = findAnyAnnotationsFolder(mediaDir);
  }

  if (!annotationsDir) {
    console.log(`No annotations folder found in: ${mediaDir}`);
    return [];
  }

  console.log(`Using annotations folder: ${annotationsDir}`);

  const segmentFiles: SegmentAudioFile[] = [];

  // List all files in the annotations directory for debugging
  try {
    const allFiles = fs.readdirSync(annotationsDir);
    console.log(`Files in annotations folder:`, allFiles);
  } catch (error) {
    console.error(`Error reading annotations folder:`, error);
  }

  // For each segment, check if the corresponding audio file exists
  // Try both space and underscore variants for the file name
  for (const segment of segments) {
    const fileName = `${segment.start}_to_${segment.end}_${tier}.wav`;
    console.log(`Looking for segment file: ${fileName} (segment ${segment.start}-${segment.end})`);
    const filePath = findFileWithNameVariants(annotationsDir, fileName);

    if (filePath) {
      // Get actual audio file duration (not segment duration)
      const actualDuration = getAudioDuration(filePath);
      console.log(`  ✓ Found: ${filePath} (actual duration: ${actualDuration.toFixed(3)}s, segment duration: ${(segment.end - segment.start).toFixed(3)}s)`);
      segmentFiles.push({
        path: filePath,
        start: segment.start,
        end: segment.end,
        duration: actualDuration, // Use actual file duration, not segment timing
      });
    } else {
      console.log(`  ✗ Not found`);
    }
  }

  console.log(`Found ${segmentFiles.length} ${tier} annotation files in ${annotationsDir}`);
  return segmentFiles;
}

/**
 * PreviewTab Component
 */
export const PreviewTab: React.FC<PreviewTabProps> = ({
  mediaFilePath,
  segments,
  audioTracks,
  playback,
  onTogglePlay,
  onProgress,
  onDuration,
}) => {
  // Local state for track volumes (will be lifted to parent later)
  const [tracks, setTracks] = useState<AudioTrack[]>([
    {
      id: "source",
      label: "Source Audio",
      url: mediaFilePath,
      volume: 100,
      muted: false,
      isKing: true,
    },
    {
      id: "careful",
      label: "Careful", // SayMore simple naming
      url: "", // Will be populated from segment files
      volume: 60,
      muted: false,
      isKing: false,
    },
    {
      id: "translation",
      label: "Translation", // SayMore simple naming
      url: "", // Will be populated from segment files
      volume: 60,
      muted: false,
      isKing: false,
    },
  ]);

  // Store segment audio file information for each tier
  const [carefulSegments, setCarefulSegments] = useState<SegmentAudioFile[]>([]);
  const [translationSegments, setTranslationSegments] = useState<SegmentAudioFile[]>([]);

  // Note: Removed kings/princes mode - all tracks play sequentially at base playback rate

  /**
   * Discover and populate annotation audio files when segments change
   */
  useEffect(() => {
    if (segments.length === 0) {
      console.log("No segments to discover annotation files for");
      return;
    }

    console.log(`Discovering annotation files for ${segments.length} segments`);

    // Discover individual segment files
    const carefulFiles = discoverAnnotationAudioFiles(mediaFilePath, segments, "Careful");
    const translationFiles = discoverAnnotationAudioFiles(mediaFilePath, segments, "Translation");

    // Store the discovered files
    setCarefulSegments(carefulFiles);
    setTranslationSegments(translationFiles);

    // Update tracks with segment files (will be concatenated on-the-fly)
    setTracks((prevTracks) =>
      prevTracks.map((track) => {
        if (track.id === "careful" && carefulFiles.length > 0) {
          // Use individual segment files with metadata
          return {
            ...track,
            url: "", // Will be generated from segment files
            segmentFiles: carefulFiles,
          } as any;
        } else if (track.id === "translation" && translationFiles.length > 0) {
          // Use individual segment files with metadata
          return {
            ...track,
            url: "", // Will be generated from segment files
            segmentFiles: translationFiles,
          } as any;
        }
        return track;
      })
    );

    console.log(`Discovered segment files - Careful: ${carefulFiles.length}, Translation: ${translationFiles.length}`);
  }, [mediaFilePath, segments]);

  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Export progress state
  const [exportProgressOpen, setExportProgressOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    stage: "Preparing",
    percent: 0,
    message: "Initializing export...",
  });
  const [exportError, setExportError] = useState<string | undefined>(undefined);

  // Oral annotation generation progress state
  const [oralAnnotationProgressOpen, setOralAnnotationProgressOpen] = useState(false);
  const [oralAnnotationProgress, setOralAnnotationProgress] = useState<ExportProgress>({
    stage: "Preparing",
    percent: 0,
    message: "Initializing...",
  });
  const [oralAnnotationError, setOralAnnotationError] = useState<string | undefined>(undefined);

  /**
   * Update track volume by index
   */
  const handleVolumeChange = (trackIndex: number, volume: number) => {
    setTracks((prevTracks) =>
      prevTracks.map((track, index) =>
        index === trackIndex ? { ...track, volume } : track
      )
    );
  };

  /**
   * Update track mute state by index
   */
  const handleMuteChange = (trackIndex: number, muted: boolean) => {
    setTracks((prevTracks) =>
      prevTracks.map((track, index) =>
        index === trackIndex ? { ...track, muted } : track
      )
    );
  };

  // Removed toggleKingsPrincesMode - no longer needed

  /**
   * Open export dialog
   */
  const handleOpenExport = () => {
    setExportDialogOpen(true);
  };

  /**
   * Handle export
   */
  const handleExport = async (settings: ExportSettings) => {
    try {
      // Close export settings dialog
      setExportDialogOpen(false);

      // Open progress dialog
      setExportProgressOpen(true);
      setExportError(undefined);
      setExportProgress({
        stage: "Preparing",
        percent: 0,
        message: "Initializing export...",
      });

      // Call main process to export
      await mainProcessApi.exportMedia(
        mediaFilePath,
        segments,
        tracks,
        { useKingsPrincesLogic: false, kingThreshold: 84 }, // Always use sequential playback
        settings
      );

      // Export completed successfully
      console.log("Export completed successfully");
    } catch (error) {
      console.error("Export failed:", error);
      setExportError(error instanceof Error ? error.message : String(error));
    }
  };

  /**
   * Handle generate oral annotation file
   * Matches SayMore's OralAnnotationFileGenerator
   */
  const handleGenerateOralAnnotation = async () => {
    try {
      // Determine annotations directory
      const mediaDir = path.dirname(mediaFilePath);
      const mediaFileNameWithExt = path.basename(mediaFilePath);
      const mediaBaseName = path.basename(mediaFilePath, path.extname(mediaFilePath));

      // Try multiple naming patterns for the annotations folder
      const annotationsFolderPatterns = [
        `${mediaFileNameWithExt}_Annotations`,  // SayMore format (with extension)
        `${mediaBaseName}_Annotations`          // Lameta format (without extension)
      ];

      let annotationsDir: string | null = null;
      for (const pattern of annotationsFolderPatterns) {
        const found = findFileWithNameVariants(mediaDir, pattern);
        if (found) {
          annotationsDir = found;
          break;
        }
      }

      // Check if annotations directory exists
      if (!annotationsDir) {
        alert("No annotations folder found. Please record at least one segment first.");
        return;
      }

      // Open progress dialog
      setOralAnnotationProgressOpen(true);
      setOralAnnotationError(undefined);
      setOralAnnotationProgress({
        stage: "Preparing",
        percent: 0,
        message: "Initializing oral annotation generation...",
      });

      // Call main process to generate oral annotation file
      const outputFile = await mainProcessApi.generateOralAnnotationFile(
        mediaFilePath,
        segments,
        annotationsDir
      );

      // Generation completed successfully
      console.log("Oral annotation file generated:", outputFile);
      alert(`Oral annotation file generated successfully:\n${outputFile}`);
    } catch (error) {
      console.error("Oral annotation generation failed:", error);
      setOralAnnotationError(error instanceof Error ? error.message : String(error));
    }
  };

  /**
   * Setup IPC listener for export progress
   */
  useEffect(() => {
    const handleProgress = (_event: any, progress: ExportProgress) => {
      setExportProgress(progress);
    };

    ipcRenderer.on("export:progress", handleProgress);

    return () => {
      ipcRenderer.removeListener("export:progress", handleProgress);
    };
  }, []);

  /**
   * Setup IPC listener for oral annotation progress
   */
  useEffect(() => {
    const handleProgress = (_event: any, progress: any) => {
      setOralAnnotationProgress({
        stage: progress.stage,
        percent: progress.percentage,
        message: progress.stage,
      });
    };

    ipcRenderer.on("oralAnnotation:progress", handleProgress);

    return () => {
      ipcRenderer.removeListener("oralAnnotation:progress", handleProgress);
    };
  }, []);

  /**
   * Close progress dialog
   */
  const handleCloseProgress = () => {
    setExportProgressOpen(false);
    setExportError(undefined);
    setExportProgress({
      stage: "Preparing",
      percent: 0,
      message: "Initializing export...",
    });
  };

  /**
   * Close oral annotation progress dialog
   */
  const handleCloseOralAnnotationProgress = () => {
    setOralAnnotationProgressOpen(false);
    setOralAnnotationError(undefined);
    setOralAnnotationProgress({
      stage: "Preparing",
      percent: 0,
      message: "Initializing...",
    });
  };

  /**
   * Video playback synchronization
   *
   * Video speed adjusts based on which track is currently playing:
   * - When Source Audio plays: video speed = basePlaybackRate
   * - When Careful/Translation plays: video speed = sourceSegmentDuration / (audioClipDuration / basePlaybackRate)
   *
   * This ensures the video reaches segment boundaries at the same time as the audio.
   */
  const videoPlayback = playback;

  return (
    <div className="preview-tab">
      {/* Video Player Section */}
      <div className="video-section">
        <VideoPlayerSection
          url={mediaFilePath}
          playback={videoPlayback}
          onProgress={onProgress}
          onDuration={onDuration}
          onPlayPause={onTogglePlay}
        />
      </div>

      {/* Multi-Track Waveform Section */}
      <div className="multi-track-section">
        <MultiTrackWaveform
          tracks={tracks}
          segments={segments}
          playing={playback.playing}
          currentTime={playback.currentTime}
          playbackRate={playback.playbackRate}
          onVolumeChange={handleVolumeChange}
          onMuteChange={handleMuteChange}
          onProgress={onProgress}
        />
      </div>

      {/* Export Section */}
      <div className="export-section">
        <button onClick={handleOpenExport} className="btn-export">
          Export Video/Audio
        </button>
        <p className="export-help">
          Export video with burned-in subtitles and mixed audio tracks using
          FFmpeg.
        </p>

        <button onClick={handleGenerateOralAnnotation} className="btn-generate-oral">
          Generate Oral Annotation File
        </button>
        <p className="export-help">
          Generate interleaved .wav file combining source, careful speech, and
          oral translation (matches SayMore format).
        </p>
      </div>

      {/* Export Dialog */}
      <ExportDialog
        isOpen={exportDialogOpen}
        mediaFilePath={mediaFilePath}
        segments={segments}
        tracks={tracks}
        kingsPrincesMode={{ useKingsPrincesLogic: false, kingThreshold: 84 }}
        onExport={handleExport}
        onClose={() => setExportDialogOpen(false)}
      />

      {/* Export Progress Dialog */}
      <ExportProgressDialog
        isOpen={exportProgressOpen}
        progress={exportProgress}
        error={exportError}
        onClose={handleCloseProgress}
      />

      {/* Oral Annotation Progress Dialog */}
      <ExportProgressDialog
        isOpen={oralAnnotationProgressOpen}
        progress={oralAnnotationProgress}
        error={oralAnnotationError}
        onClose={handleCloseOralAnnotationProgress}
      />

      {/* Playback Controls */}
      <div className="playback-controls">
        <button onClick={onTogglePlay}>
          {playback.playing ? "⏸ Pause" : "▶ Play"}
        </button>
        <span className="time-display">
          {playback.currentTime.toFixed(1)}s / {playback.duration.toFixed(1)}s
        </span>
        <label>
          Speed:
          <select
            value={playback.playbackRate}
            onChange={(e) => console.log("Speed change:", e.target.value)}
          >
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1.0">1.0x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
          </select>
        </label>
      </div>
    </div>
  );
};

export default PreviewTab;
