/**
 * MultiTrackWaveform - Multi-layer audio playback component
 * Inspired by Prestige's "kings and princes" playback logic
 *
 * Supports two modes:
 * 1. Kings & Princes mode: Tracks with volume >= 84% play at normal speed (kings),
 *    tracks with volume < 84% play at slower speed (princes)
 * 2. All Kings mode: All enabled tracks play at normal speed
 */

import React, { useRef, useEffect, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { AudioTrack } from "../shared/types";
import "./MultiTrackWaveform.css";

/**
 * Configuration for kings/princes playback
 */
export interface KingsPrincesMode {
  /** Whether to use kings/princes logic (true) or all kings mode (false) */
  useKingsPrincesLogic: boolean;

  /** Volume threshold for kings (default: 84 which is 84%) */
  kingThreshold: number;
}

/**
 * Props for MultiTrackWaveform component
 */
export interface MultiTrackWaveformProps {
  /** Audio tracks to display */
  tracks: AudioTrack[];

  /** Whether playback is active */
  playing: boolean;

  /** Current playback time in seconds */
  currentTime: number;

  /** Playback rate for kings */
  playbackRate: number;

  /** Kings/Princes configuration */
  kingsPrincesMode: KingsPrincesMode;

  /** Callback when track volume changes */
  onVolumeChange: (trackIndex: number, volume: number) => void;

  /** Callback when track mute state changes */
  onMuteChange: (trackIndex: number, muted: boolean) => void;

  /** Callback when playback position changes */
  onProgress?: (currentTime: number) => void;

  /** Optional CSS class name */
  className?: string;
}

/**
 * MultiTrackWaveform Component
 *
 * Displays multiple audio tracks with synchronized playback.
 * Implements Prestige-inspired kings/princes logic for multi-layer playback.
 */
export const MultiTrackWaveform: React.FC<MultiTrackWaveformProps> = ({
  tracks,
  playing,
  currentTime,
  playbackRate,
  kingsPrincesMode,
  onVolumeChange,
  onMuteChange,
  onProgress,
  className = "",
}) => {
  const wavesurferRefs = useRef<(WaveSurfer | null)[]>([]);
  const containerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [readyStates, setReadyStates] = useState<boolean[]>(new Array(tracks.length).fill(false));

  /**
   * Calculate effective playback rate for a track (Prestige algorithm)
   *
   * Kings & Princes logic:
   * - King: Plays at base playback rate, determines segment duration
   * - Prince: Time-stretches/compresses to match king's duration
   *   - If prince is SHORTER than king → plays SLOWER (time-stretched)
   *   - If prince is LONGER than king → plays FASTER (time-compressed)
   *
   * Formula: princeSpeed = princeDuration / (kingDuration / playbackRate)
   *
   * This ensures all tracks end simultaneously at segment boundaries.
   */
  const getEffectivePlaybackRate = (track: AudioTrack, trackIndex: number): number => {
    if (track.muted) return playbackRate;

    // All Kings mode: everything plays at base speed
    if (!kingsPrincesMode.useKingsPrincesLogic) {
      return playbackRate;
    }

    // Check if this track is a king
    const isKing = track.volume >= kingsPrincesMode.kingThreshold;

    if (isKing) {
      // Kings play at base playback rate
      return playbackRate;
    } else {
      // Prince: adjust speed to match king's play duration
      // Get this prince's audio duration
      const princeWs = wavesurferRefs.current[trackIndex];
      if (!princeWs || !readyStates[trackIndex]) {
        // Not ready yet, use base rate temporarily
        return playbackRate;
      }

      const princeDuration = princeWs.getDuration();
      if (!princeDuration || princeDuration === 0) {
        return playbackRate;
      }

      // Find the king track and get its duration
      let kingDuration = 0;

      // Priority: source (0), careful (1), translation (2)
      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        if (!t.muted && t.volume >= kingsPrincesMode.kingThreshold) {
          const kingWs = wavesurferRefs.current[i];
          if (kingWs && readyStates[i]) {
            kingDuration = kingWs.getDuration();
            break;
          }
        }
      }

      if (kingDuration === 0) {
        // No king found, prince plays at base rate
        return playbackRate;
      }

      // Calculate how long the king will take to play at its speed
      const kingPlayDuration = kingDuration / playbackRate;

      // Calculate prince speed to end at same time as king
      // From Prestige: A2Speed = (A2Stop - A2Start) / kingLen
      const princeSpeed = princeDuration / kingPlayDuration;

      // Examples:
      // - Prince 3s, king plays for 10s: 3/10 = 0.3x (stretched, slower)
      // - Prince 15s, king plays for 10s: 15/10 = 1.5x (compressed, faster)
      return princeSpeed;
    }
  };

  /**
   * Get track label (SayMore simple naming)
   */
  const getTrackLabel = (trackIndex: number): string => {
    switch (trackIndex) {
      case 0:
        return "Source Audio";
      case 1:
        return "Careful"; // SayMore simple naming
      case 2:
        return "Translation"; // SayMore simple naming
      default:
        return `Track ${trackIndex + 1}`;
    }
  };

  /**
   * Initialize WaveSurfer instances
   */
  useEffect(() => {
    tracks.forEach((track, index) => {
      if (!containerRefs.current[index] || !track.url) return;

      // Create WaveSurfer instance if it doesn't exist
      if (!wavesurferRefs.current[index]) {
        const ws = WaveSurfer.create({
          container: containerRefs.current[index]!,
          waveColor: "#94c397",
          progressColor: "#e69664",
          height: 80,
          normalize: true,
          barWidth: 2,
          barGap: 1,
        });

        ws.load(track.url);

        ws.on("ready", () => {
          setReadyStates((prev) => {
            const newStates = [...prev];
            newStates[index] = true;
            return newStates;
          });
        });

        ws.on("audioprocess", (time: number) => {
          if (onProgress && index === 0) {
            // Only report progress from first track to avoid conflicts
            onProgress(time);
          }
        });

        wavesurferRefs.current[index] = ws;
      }
    });

    // Cleanup
    return () => {
      wavesurferRefs.current.forEach((ws) => {
        if (ws) {
          ws.destroy();
        }
      });
      wavesurferRefs.current = [];
    };
  }, [tracks]);

  /**
   * Sync playback state
   */
  useEffect(() => {
    wavesurferRefs.current.forEach((ws, index) => {
      if (!ws || !readyStates[index]) return;

      if (playing) {
        ws.play();
      } else {
        ws.pause();
      }
    });
  }, [playing, readyStates]);

  /**
   * Sync playback position
   */
  useEffect(() => {
    wavesurferRefs.current.forEach((ws, index) => {
      if (!ws || !readyStates[index]) return;

      const currentWsTime = ws.getCurrentTime();
      const timeDiff = Math.abs(currentWsTime - currentTime);

      // Only seek if difference is significant
      if (timeDiff > 0.5) {
        ws.seekTo(currentTime / ws.getDuration());
      }
    });
  }, [currentTime, readyStates]);

  /**
   * Sync volume and mute state
   */
  useEffect(() => {
    wavesurferRefs.current.forEach((ws, index) => {
      if (!ws || !readyStates[index]) return;

      const track = tracks[index];
      // Convert volume from 0-100 scale to 0-1 scale for WaveSurfer
      ws.setVolume(track.muted ? 0 : track.volume / 100);
    });
  }, [tracks, readyStates]);

  /**
   * Sync playback rate (with kings/princes logic)
   */
  useEffect(() => {
    wavesurferRefs.current.forEach((ws, index) => {
      if (!ws || !readyStates[index]) return;

      const track = tracks[index];
      const effectiveRate = getEffectivePlaybackRate(track, index);
      ws.setPlaybackRate(effectiveRate);
    });
  }, [playbackRate, tracks, kingsPrincesMode, readyStates]);

  /**
   * Handle volume slider change
   */
  const handleVolumeChange = (trackIndex: number, value: number) => {
    onVolumeChange(trackIndex, value);
  };

  /**
   * Handle mute checkbox change
   */
  const handleMuteChange = (trackIndex: number, checked: boolean) => {
    onMuteChange(trackIndex, checked);
  };

  /**
   * Render track status indicator
   */
  const renderTrackStatus = (track: AudioTrack, trackIndex: number): React.ReactNode => {
    if (!kingsPrincesMode.useKingsPrincesLogic || track.muted) {
      return null;
    }

    const isKing = track.volume >= kingsPrincesMode.kingThreshold;
    return (
      <span className={`track-status ${isKing ? "king" : "prince"}`} title={isKing ? "King (normal speed)" : "Prince (slower speed)"}>
        {isKing ? "👑" : "🤴"}
      </span>
    );
  };

  return (
    <div className={`multi-track-waveform ${className}`}>
      {/* Kings/Princes Mode Indicator */}
      <div className="mode-indicator">
        <strong>Playback Mode:</strong>{" "}
        {kingsPrincesMode.useKingsPrincesLogic ? "Kings & Princes" : "All Kings"}
        {kingsPrincesMode.useKingsPrincesLogic && (
          <span className="mode-hint" title="Tracks >= 84% volume play at normal speed (kings), tracks < 84% play slower (princes)">
            {" "}ℹ️
          </span>
        )}
      </div>

      {/* Track List */}
      {tracks.map((track, index) => (
        <div key={index} className="audio-track">
          {/* Track Header */}
          <div className="track-header">
            <div className="track-label">
              <strong>{getTrackLabel(index)}</strong>
              {renderTrackStatus(track, index)}
            </div>
            <div className="track-controls">
              {/* Mute Checkbox */}
              <label className="mute-control">
                <input
                  type="checkbox"
                  checked={track.muted}
                  onChange={(e) => handleMuteChange(index, e.target.checked)}
                />
                Mute
              </label>

              {/* Volume Slider */}
              <label className="volume-control">
                <span className="volume-label">Volume: {Math.round(track.volume)}%</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={track.volume}
                  onChange={(e) => handleVolumeChange(index, parseInt(e.target.value, 10))}
                  disabled={track.muted}
                  className="volume-slider"
                />
              </label>
            </div>
          </div>

          {/* Waveform Container */}
          <div
            ref={(el) => (containerRefs.current[index] = el)}
            className="track-waveform"
          >
            {!track.url && (
              <div className="no-audio-placeholder">
                <p>No audio file for this track</p>
              </div>
            )}
            {track.url && !readyStates[index] && (
              <div className="loading-placeholder">
                <p>Loading waveform...</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MultiTrackWaveform;
