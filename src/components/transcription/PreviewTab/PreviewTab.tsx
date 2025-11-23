/**
 * PreviewTab - Prestige-inspired multi-layer playback and export
 * Provides synchronized playback of source, careful speech, and translation tracks
 */

import React, { useState } from "react";
import "./PreviewTab.css";
import VideoPlayerSection from "../shared/VideoPlayerSection";
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

  /**
   * Update track volume
   */
  const handleVolumeChange = (trackId: string, volume: number) => {
    setTracks((prevTracks) =>
      prevTracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              volume,
              isKing: volume >= 84, // King threshold
            }
          : track
      )
    );
  };

  /**
   * Toggle track mute
   */
  const handleMuteToggle = (trackId: string) => {
    setTracks((prevTracks) =>
      prevTracks.map((track) =>
        track.id === trackId ? { ...track, muted: !track.muted } : track
      )
    );
  };

  /**
   * Open export dialog
   */
  const handleExport = () => {
    console.log("Opening export dialog...");
    // TODO: Implement export dialog
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

      {/* Multi-Track Waveform Section */}
      <div className="multi-track-section">
        <h3>Multi-Layer Playback</h3>
        <div className="track-waveforms">
          {tracks.map((track) => (
            <div key={track.id} className="track-row">
              <div className="track-info">
                <label className="track-label">
                  {track.label}
                  {track.isKing && <span className="king-badge">👑 King</span>}
                  {!track.isKing && track.volume > 0 && (
                    <span className="prince-badge">🤴 Prince</span>
                  )}
                </label>
              </div>
              <div className="track-waveform-placeholder">
                <p>Waveform for {track.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Volume Controls */}
      <div className="volume-controls-section">
        <h3>Volume Controls</h3>
        <div className="volume-controls">
          {tracks.map((track) => (
            <div key={track.id} className="volume-control">
              <label className="volume-label">
                <input
                  type="checkbox"
                  checked={!track.muted}
                  onChange={() => handleMuteToggle(track.id)}
                />
                {track.label}
              </label>
              <div className="volume-slider-container">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={track.volume}
                  onChange={(e) =>
                    handleVolumeChange(track.id, parseInt(e.target.value))
                  }
                  disabled={track.muted}
                  className="volume-slider"
                />
                <span className="volume-value">{track.volume}%</span>
              </div>
            </div>
          ))}
        </div>

        {/* Kings and Princes Info */}
        <div className="kings-princes-info">
          <div className="info-row">
            <strong>Kings (≥84%):</strong>{" "}
            {kings.length > 0 ? kings.map((t) => t.label).join(", ") : "None"}
          </div>
          <div className="info-row">
            <strong>Princes (&lt;84%):</strong>{" "}
            {princes.length > 0 ? princes.map((t) => t.label).join(", ") : "None"}
          </div>
          <div className="info-note">
            <em>
              Kings play at normal speed. Princes are speed-adjusted to match
              kings during export.
            </em>
          </div>
        </div>
      </div>

      {/* Export Section */}
      <div className="export-section">
        <button onClick={handleExport} className="btn-export">
          Export Video/Audio
        </button>
        <p className="export-help">
          Export video with burned-in subtitles and mixed audio tracks using
          FFmpeg.
        </p>
      </div>

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
