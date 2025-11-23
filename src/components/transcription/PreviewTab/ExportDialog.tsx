/**
 * ExportDialog - Video/Audio export with FFmpeg
 * Based on Prestige's ExportVid algorithm
 * Supports subtitle burning, multi-track audio mixing, and kings/princes logic
 */

import React, { useState } from "react";
import { AnnotationSegment, AudioTrack } from "../shared/types";
import { KingsPrincesMode } from "./MultiTrackWaveform";
import "./ExportDialog.css";

/**
 * Export format options
 */
export enum ExportFormat {
  Video = "video",
  AudioOnly = "audio",
}

/**
 * Export settings
 */
export interface ExportSettings {
  /** Output format */
  format: ExportFormat;

  /** Include subtitles (video only) */
  includeSubtitles: boolean;

  /** Subtitle language */
  subtitleLanguage: "transcription" | "translation" | "both";

  /** Output file path */
  outputPath: string;

  /** Video quality (0-51, lower is better) */
  videoQuality: number;

  /** Audio bitrate in kbps */
  audioBitrate: number;
}

/**
 * Props for ExportDialog
 */
export interface ExportDialogProps {
  /** Whether dialog is open */
  isOpen: boolean;

  /** Source media file path */
  mediaFilePath: string;

  /** Annotation segments */
  segments: AnnotationSegment[];

  /** Audio tracks */
  tracks: AudioTrack[];

  /** Kings/Princes mode configuration */
  kingsPrincesMode: KingsPrincesMode;

  /** Callback when export starts */
  onExport: (settings: ExportSettings) => void;

  /** Callback when dialog closes */
  onClose: () => void;
}

/**
 * Default export settings
 */
const DEFAULT_SETTINGS: ExportSettings = {
  format: ExportFormat.Video,
  includeSubtitles: true,
  subtitleLanguage: "both",
  outputPath: "",
  videoQuality: 23,
  audioBitrate: 192,
};

/**
 * ExportDialog Component
 *
 * Provides UI for configuring video/audio export with FFmpeg.
 * Supports Prestige-style kings/princes audio mixing and subtitle burning.
 */
export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  mediaFilePath,
  segments,
  tracks,
  kingsPrincesMode,
  onExport,
  onClose,
}) => {
  const [settings, setSettings] = useState<ExportSettings>(DEFAULT_SETTINGS);

  /**
   * Handle setting change
   */
  const handleSettingChange = <K extends keyof ExportSettings>(
    key: K,
    value: ExportSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * Handle export
   */
  const handleExport = () => {
    onExport(settings);
    onClose();
  };

  /**
   * Get estimated file size
   */
  const getEstimatedSize = (): string => {
    if (segments.length === 0) return "0 MB";

    // Calculate total duration
    const totalDuration = segments.reduce(
      (sum, seg) => sum + (seg.end - seg.start),
      0
    );

    if (settings.format === ExportFormat.AudioOnly) {
      // Audio only: bitrate * duration
      const sizeMB = (settings.audioBitrate * totalDuration) / (8 * 1024);
      return `~${sizeMB.toFixed(1)} MB`;
    } else {
      // Video: rough estimate based on quality
      // Lower CRF = higher quality = larger file
      const qualityFactor = Math.exp((51 - settings.videoQuality) / 10);
      const videoSizeMB = (totalDuration * qualityFactor * 0.5); // Rough estimate
      const audioSizeMB = (settings.audioBitrate * totalDuration) / (8 * 1024);
      return `~${(videoSizeMB + audioSizeMB).toFixed(1)} MB`;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="export-dialog-overlay">
      <div className="export-dialog">
        {/* Header */}
        <div className="export-dialog-header">
          <h3>Export Video/Audio</h3>
          <button onClick={onClose} className="btn-close" title="Close">
            ✕
          </button>
        </div>

        {/* Export Settings */}
        <div className="export-settings">
          {/* Format */}
          <div className="setting-group">
            <label className="setting-label">
              <strong>Format:</strong>
            </label>
            <select
              value={settings.format}
              onChange={(e) =>
                handleSettingChange("format", e.target.value as ExportFormat)
              }
              className="setting-select"
            >
              <option value={ExportFormat.Video}>Video (MP4)</option>
              <option value={ExportFormat.AudioOnly}>Audio Only (MP3)</option>
            </select>
          </div>

          {/* Subtitles (Video only) */}
          {settings.format === ExportFormat.Video && (
            <>
              <div className="setting-group">
                <label className="setting-checkbox">
                  <input
                    type="checkbox"
                    checked={settings.includeSubtitles}
                    onChange={(e) =>
                      handleSettingChange("includeSubtitles", e.target.checked)
                    }
                  />
                  Burn-in subtitles
                </label>
              </div>

              {settings.includeSubtitles && (
                <div className="setting-group">
                  <label className="setting-label">
                    <strong>Subtitle Content:</strong>
                  </label>
                  <select
                    value={settings.subtitleLanguage}
                    onChange={(e) =>
                      handleSettingChange(
                        "subtitleLanguage",
                        e.target.value as "transcription" | "translation" | "both"
                      )
                    }
                    className="setting-select"
                  >
                    <option value="transcription">Transcription only</option>
                    <option value="translation">Translation only</option>
                    <option value="both">Both (dual subtitles)</option>
                  </select>
                </div>
              )}

              {/* Video Quality */}
              <div className="setting-group">
                <label className="setting-label">
                  <strong>Video Quality:</strong>
                  <span className="setting-value">
                    {settings.videoQuality === 0 && "Lossless"}
                    {settings.videoQuality > 0 && settings.videoQuality <= 18 && "Very High"}
                    {settings.videoQuality > 18 && settings.videoQuality <= 23 && "High"}
                    {settings.videoQuality > 23 && settings.videoQuality <= 28 && "Medium"}
                    {settings.videoQuality > 28 && "Low"}
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="51"
                  value={settings.videoQuality}
                  onChange={(e) =>
                    handleSettingChange("videoQuality", parseInt(e.target.value, 10))
                  }
                  className="setting-slider"
                />
                <small className="setting-hint">
                  Lower = better quality, larger file
                </small>
              </div>
            </>
          )}

          {/* Audio Bitrate */}
          <div className="setting-group">
            <label className="setting-label">
              <strong>Audio Bitrate:</strong>
              <span className="setting-value">{settings.audioBitrate} kbps</span>
            </label>
            <input
              type="range"
              min="64"
              max="320"
              step="32"
              value={settings.audioBitrate}
              onChange={(e) =>
                handleSettingChange("audioBitrate", parseInt(e.target.value, 10))
              }
              className="setting-slider"
            />
          </div>

          {/* Estimated Size */}
          <div className="setting-info">
            <strong>Estimated Size:</strong> {getEstimatedSize()}
          </div>

          {/* Kings/Princes Info */}
          <div className="setting-info">
            <strong>Audio Mixing Mode:</strong>{" "}
            {kingsPrincesMode.useKingsPrincesLogic ? "Kings & Princes" : "All Kings"}
            {kingsPrincesMode.useKingsPrincesLogic && (
              <small className="setting-hint">
                Tracks &lt;84% volume will be speed-adjusted
              </small>
            )}
          </div>

          {/* Segment Count */}
          <div className="setting-info">
            <strong>Segments:</strong> {segments.length} clips will be concatenated
          </div>
        </div>

        {/* Action Buttons */}
        <div className="dialog-actions">
          <button onClick={onClose} className="btn-cancel">
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={segments.length === 0}
            className="btn-export"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
