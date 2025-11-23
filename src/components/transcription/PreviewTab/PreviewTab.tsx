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
      label: "Careful Speech",
      url: "", // Will be populated from segment files
      volume: 60,
      muted: false,
      isKing: false,
    },
    {
      id: "translation",
      label: "Oral Translation",
      url: "", // Will be populated from segment files
      volume: 60,
      muted: false,
      isKing: false,
    },
  ]);

  // Kings/Princes mode configuration
  const [kingsPrincesMode, setKingsPrincesMode] = useState<KingsPrincesMode>({
    useKingsPrincesLogic: true, // Default to traditional kings/princes mode
    kingThreshold: 84, // 84% volume threshold
  });

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
        index === trackIndex
          ? {
              ...track,
              volume,
              isKing: volume >= kingsPrincesMode.kingThreshold,
            }
          : track
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

  /**
   * Toggle kings/princes mode
   */
  const toggleKingsPrincesMode = () => {
    setKingsPrincesMode((prev) => ({
      ...prev,
      useKingsPrincesLogic: !prev.useKingsPrincesLogic,
    }));
  };

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
        kingsPrincesMode,
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
      const path = require("path");
      const mediaDir = path.dirname(mediaFilePath);
      const mediaBaseName = path.basename(mediaFilePath, path.extname(mediaFilePath));
      const annotationsDir = path.join(mediaDir, `${mediaBaseName}_Annotations`);

      // Check if annotations directory exists
      const fs = require("fs");
      if (!fs.existsSync(annotationsDir)) {
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
   * Categorize tracks into kings and princes
   */
  const kings = tracks.filter((t) => !t.muted && t.isKing);
  const princes = tracks.filter((t) => !t.muted && !t.isKing && t.volume > 0);

  return (
    <div className="preview-tab">
      {/* Video Player Section */}
      <div className="video-section">
        <VideoPlayerSection
          url={mediaFilePath}
          playback={playback}
          onProgress={onProgress}
          onDuration={onDuration}
          onPlayPause={onTogglePlay}
        />
      </div>

      {/* Mode Toggle */}
      <div className="mode-toggle-section">
        <button onClick={toggleKingsPrincesMode} className="btn-toggle-mode">
          {kingsPrincesMode.useKingsPrincesLogic
            ? "Switch to All Kings Mode"
            : "Switch to Kings & Princes Mode"}
        </button>
        <p className="mode-description">
          {kingsPrincesMode.useKingsPrincesLogic
            ? "Current: Kings & Princes - Tracks ≥84% play at normal speed, tracks <84% play slower"
            : "Current: All Kings - All enabled tracks play at normal speed"}
        </p>
      </div>

      {/* Multi-Track Waveform Section */}
      <div className="multi-track-section">
        <MultiTrackWaveform
          tracks={tracks}
          playing={playback.playing}
          currentTime={playback.currentTime}
          playbackRate={playback.playbackRate}
          kingsPrincesMode={kingsPrincesMode}
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
        kingsPrincesMode={kingsPrincesMode}
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
