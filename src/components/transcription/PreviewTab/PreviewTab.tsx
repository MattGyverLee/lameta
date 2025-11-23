/**
 * PreviewTab - Prestige-inspired multi-layer playback and export
 * Provides synchronized playback of source, careful speech, and translation tracks
 */

import React, { useState } from "react";
import "./PreviewTab.css";
import VideoPlayerSection from "../shared/VideoPlayerSection";
import MultiTrackWaveform, { KingsPrincesMode } from "./MultiTrackWaveform";
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
