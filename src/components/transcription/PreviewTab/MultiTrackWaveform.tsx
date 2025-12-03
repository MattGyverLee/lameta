/**
 * MultiTrackWaveform - Multi-layer audio playback component
 * Inspired by Prestige's "kings and princes" playback logic
 *
 * Supports two modes:
 * 1. Kings & Princes mode: Tracks with volume >= 84% play at normal speed (kings),
 *    tracks with volume < 84% play at slower speed (princes)
 * 2. All Kings mode: All enabled tracks play at normal speed
 */

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions";
import { AudioTrack, AnnotationSegment, MultiTrackWaveformHandle } from "../shared/types";
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

  /** Annotation segments to display as colored regions */
  segments?: AnnotationSegment[];

  /** Whether playback is active */
  playing: boolean;

  /** Current playback time in seconds */
  currentTime: number;

  /** Base playback rate (all tracks play at this speed) */
  playbackRate: number;

  /** Index of currently playing track (for visual feedback) */
  currentlyPlayingTrack?: number;

  /** Callback when track volume changes */
  onVolumeChange: (trackIndex: number, volume: number) => void;

  /** Callback when track mute state changes */
  onMuteChange: (trackIndex: number, muted: boolean) => void;

  /** Callback when playback position changes */
  onProgress?: (currentTime: number) => void;

  /** Callback when a track finishes playing (for sequential playback) */
  onTrackFinished?: () => void;

  /** Optional CSS class name */
  className?: string;
}

/**
 * MultiTrackWaveform Component
 *
 * Displays multiple audio tracks with synchronized playback.
 * Implements Prestige-inspired kings/princes logic for multi-layer playback.
 */
export const MultiTrackWaveform = forwardRef<MultiTrackWaveformHandle, MultiTrackWaveformProps>(({
  tracks,
  segments = [],
  playing,
  currentTime,
  playbackRate,
  currentlyPlayingTrack,
  onVolumeChange,
  onMuteChange,
  onProgress,
  onTrackFinished,
  className = "",
}, ref) => {
  const wavesurferRefs = useRef<(WaveSurfer | null)[]>([]);
  const regionsPluginRefs = useRef<(any | null)[]>([]);
  const containerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [readyStates, setReadyStates] = useState<boolean[]>(new Array(tracks.length).fill(false));

  // Track active event listeners for cleanup
  const activeListenersRef = useRef<Map<number, () => void>>(new Map());

  /**
   * Expose imperative handle for parent component control
   */
  useImperativeHandle(ref, () => ({
    playSegment: (segmentIndex: number, trackIndex: number) => {
      const wavesurfer = wavesurferRefs.current[trackIndex];
      const track = tracks[trackIndex];

      if (!wavesurfer || !track || !segments) return;

      const segment = segments[segmentIndex];
      if (!segment) return;

      console.log(`MultiTrackWaveform.playSegment: segment ${segmentIndex}, track ${trackIndex} (${track.label})`);

      // Clean up any existing listener for this track
      const existingListener = activeListenersRef.current.get(trackIndex);
      if (existingListener) {
        wavesurfer.un("audioprocess", existingListener);
        activeListenersRef.current.delete(trackIndex);
      }

      // Pause all other tracks
      wavesurferRefs.current.forEach((ws, idx) => {
        if (ws && idx !== trackIndex) {
          ws.pause();
        }
      });

      // For source track: seek to segment start and play
      if (track.id === "source") {
        const duration = wavesurfer.getDuration();
        if (duration > 0) {
          const relativeStart = segment.start / duration;
          console.log(`  Seeking to ${segment.start}s (${(relativeStart * 100).toFixed(1)}% of ${duration.toFixed(2)}s)`);
          wavesurfer.seekTo(relativeStart);

          // Set up finish event for this segment
          const handleFinish = () => {
            const currentTime = wavesurfer.getCurrentTime();
            if (currentTime >= segment.end - 0.05) { // Small buffer for timing accuracy
              console.log(`  Segment finished at ${currentTime.toFixed(3)}s (end: ${segment.end}s)`);
              wavesurfer.pause();

              // Clean up listener
              wavesurfer.un("audioprocess", handleFinish);
              activeListenersRef.current.delete(trackIndex);

              // Notify parent
              if (onTrackFinished) {
                setTimeout(() => onTrackFinished(), 50); // Small delay for smooth transition
              }
            }
          };

          activeListenersRef.current.set(trackIndex, handleFinish);
          wavesurfer.on("audioprocess", handleFinish);

          wavesurfer.play();
        }
      } else {
        // For annotation tracks: find concatenated position
        const segmentFiles = (track as any).segmentFiles || [];
        let currentPosition = 0;
        let targetPosition = -1;
        let clipDuration = 0;

        for (let i = 0; i < segmentFiles.length; i++) {
          const segFile = segmentFiles[i];
          if (Math.abs(segFile.start - segment.start) < 0.001) {
            targetPosition = currentPosition;
            clipDuration = segFile.duration;
            break;
          }
          currentPosition += segFile.duration;
        }

        if (targetPosition >= 0) {
          const duration = wavesurfer.getDuration();
          if (duration > 0) {
            const relativeStart = targetPosition / duration;
            console.log(`  Seeking to concatenated position ${targetPosition.toFixed(3)}s (${(relativeStart * 100).toFixed(1)}% of ${duration.toFixed(2)}s), clip duration: ${clipDuration.toFixed(3)}s`);
            wavesurfer.seekTo(relativeStart);

            // Set up finish event for this clip
            const targetEnd = targetPosition + clipDuration;
            const handleFinish = () => {
              const currentTime = wavesurfer.getCurrentTime();
              if (currentTime >= targetEnd - 0.05) { // Small buffer for timing accuracy
                console.log(`  Clip finished at ${currentTime.toFixed(3)}s (end: ${targetEnd.toFixed(3)}s)`);
                wavesurfer.pause();

                // Clean up listener
                wavesurfer.un("audioprocess", handleFinish);
                activeListenersRef.current.delete(trackIndex);

                // Notify parent
                if (onTrackFinished) {
                  setTimeout(() => onTrackFinished(), 50); // Small delay for smooth transition
                }
              }
            };

            activeListenersRef.current.set(trackIndex, handleFinish);
            wavesurfer.on("audioprocess", handleFinish);

            wavesurfer.play();
          }
        }
      }
    },

    pauseAll: () => {
      wavesurferRefs.current.forEach((ws, idx) => {
        if (ws) {
          ws.pause();
          // Clean up listener for this track
          const listener = activeListenersRef.current.get(idx);
          if (listener) {
            ws.un("audioprocess", listener);
            activeListenersRef.current.delete(idx);
          }
        }
      });
    },

    stopAll: () => {
      wavesurferRefs.current.forEach((ws, idx) => {
        if (ws) {
          ws.pause();
          ws.seekTo(0);
          // Clean up listener for this track
          const listener = activeListenersRef.current.get(idx);
          if (listener) {
            ws.un("audioprocess", listener);
            activeListenersRef.current.delete(idx);
          }
        }
      });
      activeListenersRef.current.clear();
    },

    getCurrentTime: (trackIndex: number) => {
      const ws = wavesurferRefs.current[trackIndex];
      return ws ? ws.getCurrentTime() : 0;
    },

    getDuration: (trackIndex: number) => {
      const ws = wavesurferRefs.current[trackIndex];
      return ws ? ws.getDuration() : 0;
    },
  }));

  /**
   * All tracks play at base playback rate
   * Sequential playback is handled by parent component
   */
  const getEffectivePlaybackRate = (): number => {
    return playbackRate;
  };

  /**
   * Get color for segment region (rainbow palette matching AnnotateTab)
   */
  const getSegmentColor = (index: number): string => {
    // Rainbow color palette (cycling through hues)
    const colors = [
      "rgba(255, 99, 132, 0.3)",   // Red
      "rgba(255, 159, 64, 0.3)",   // Orange
      "rgba(255, 205, 86, 0.3)",   // Yellow
      "rgba(75, 192, 192, 0.3)",   // Cyan
      "rgba(54, 162, 235, 0.3)",   // Blue
      "rgba(153, 102, 255, 0.3)",  // Purple
      "rgba(201, 203, 207, 0.3)",  // Gray
      "rgba(255, 99, 255, 0.3)",   // Magenta
    ];

    return colors[index % colors.length];
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
   * Concatenate audio files using Web Audio API
   */
  const concatenateAudioFiles = async (segmentFiles: any[]): Promise<Blob> => {
    const audioContext = new AudioContext();
    const audioBuffers: AudioBuffer[] = [];

    // Load all segment files
    for (const segmentFile of segmentFiles) {
      const response = await fetch(`file://${segmentFile.path}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      audioBuffers.push(audioBuffer);
    }

    // Calculate total length
    const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
    const numberOfChannels = audioBuffers[0].numberOfChannels;
    const sampleRate = audioBuffers[0].sampleRate;

    // Create concatenated buffer
    const concatenatedBuffer = audioContext.createBuffer(
      numberOfChannels,
      totalLength,
      sampleRate
    );

    // Copy data from each buffer
    let offset = 0;
    for (const buffer of audioBuffers) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        concatenatedBuffer.getChannelData(channel).set(buffer.getChannelData(channel), offset);
      }
      offset += buffer.length;
    }

    // Convert to WAV blob
    const wavBlob = await audioBufferToWav(concatenatedBuffer);
    return wavBlob;
  };

  /**
   * Convert AudioBuffer to WAV Blob
   */
  const audioBufferToWav = async (buffer: AudioBuffer): Promise<Blob> => {
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;

    const data = new Float32Array(buffer.length * numberOfChannels);
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < buffer.length; i++) {
        data[i * numberOfChannels + channel] = channelData[i];
      }
    }

    const dataLength = data.length * bytesPerSample;
    const bufferLength = 44 + dataLength;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, bufferLength - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    // PCM samples
    let offset = 44;
    for (let i = 0; i < data.length; i++) {
      const sample = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  /**
   * Initialize WaveSurfer instances
   */
  useEffect(() => {
    tracks.forEach(async (track, index) => {
      if (!containerRefs.current[index]) return;

      // Skip if no URL and no segment files
      if (!track.url && (!track.segmentFiles || track.segmentFiles.length === 0)) return;

      // Check if this track has segment files
      const hasSegmentFiles = track.segmentFiles && track.segmentFiles.length > 0;

      // Create WaveSurfer instance if it doesn't exist
      if (!wavesurferRefs.current[index]) {
        // Create regions plugin for segment boundaries
        const regionsPlugin = RegionsPlugin.create();
        regionsPluginRefs.current[index] = regionsPlugin;

        const ws = WaveSurfer.create({
          container: containerRefs.current[index]!,
          waveColor: "#94c397",
          progressColor: "#e69664",
          height: 80,
          normalize: true,
          barWidth: 2,
          barGap: 1,
          plugins: [regionsPlugin],
        });

        if (hasSegmentFiles) {
          // Concatenate segment files
          try {
            console.log(`Concatenating ${track.segmentFiles!.length} segment files for track ${index}`);
            const concatenatedBlob = await concatenateAudioFiles(track.segmentFiles!);
            const blobUrl = URL.createObjectURL(concatenatedBlob);
            ws.load(blobUrl);
          } catch (error) {
            console.error("Failed to concatenate segment files:", error);
          }
        } else {
          // Regular single audio file
          ws.load(track.url);
        }

        ws.on("ready", () => {
          const duration = ws.getDuration();
          console.log(`Track ${index} (${getTrackLabel(index)}) waveform ready. Duration: ${duration.toFixed(3)}s`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Only re-initialize if track count, URLs, or segment files change
    // NOT when volume/mute changes (those are handled by separate effects)
    tracks.length,
    tracks.map(t => t.url).join(','),
    tracks.map(t => t.segmentFiles?.length || 0).join(','),
  ]);

  /**
   * NOTE: Playback is now controlled imperatively via the ref handle.
   * The old playback/seek sync effects have been removed to prevent conflicts
   * with sequential playback control.
   */

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
   * Sync playback rate (all tracks play at base rate)
   */
  useEffect(() => {
    wavesurferRefs.current.forEach((ws, index) => {
      if (!ws || !readyStates[index]) return;

      const effectiveRate = getEffectivePlaybackRate();
      ws.setPlaybackRate(effectiveRate);
    });
  }, [playbackRate, readyStates]);

  /**
   * Add segment regions to all tracks
   * - Source track: regions at original timeline positions
   * - Careful/Translation tracks (merged): regions for each clip (concatenated), colored by source segment
   */
  useEffect(() => {
    if (segments.length === 0) return;

    regionsPluginRefs.current.forEach((regionsPlugin, trackIndex) => {
      if (!regionsPlugin || !readyStates[trackIndex]) return;

      // Clear existing regions
      regionsPlugin.clearRegions();

      const track = tracks[trackIndex];

      // Check if this track has segment files metadata (merged annotation track)
      if (track.segmentFiles && track.segmentFiles.length > 0) {
        // For merged annotation tracks: create regions for each clip based on concatenated position
        let currentPosition = 0;

        console.log(`\n=== Track ${trackIndex} (${getTrackLabel(trackIndex)}): Processing ${track.segmentFiles.length} segment files ===`);
        console.log('All segments in ELAN:', segments.map((s, i) => `[${i}] ${s.start.toFixed(3)}-${s.end.toFixed(3)}`).join(', '));

        const waveformDuration = wavesurferRefs.current[trackIndex]?.getDuration() || 0;

        track.segmentFiles.forEach((segmentFile, clipIndex) => {
          // Find the corresponding segment index to get the right color
          const segmentIndex = segments.findIndex(
            s => Math.abs(s.start - segmentFile.start) < 0.001 && Math.abs(s.end - segmentFile.end) < 0.001
          );

          const color = segmentIndex >= 0 ? getSegmentColor(segmentIndex) : 'gray';
          const regionStart = currentPosition;
          const regionEnd = currentPosition + segmentFile.duration;

          console.log(`  Clip ${clipIndex}: ${segmentFile.start.toFixed(3)}-${segmentFile.end.toFixed(3)} (duration: ${segmentFile.duration.toFixed(3)}s)`);
          console.log(`    → Matched to segment index: ${segmentIndex} (color: ${color})`);
          console.log(`    → Region position: ${regionStart.toFixed(3)}s - ${regionEnd.toFixed(3)}s`);

          if (segmentIndex >= 0) {
            // Check if region is within waveform bounds
            if (regionStart >= waveformDuration) {
              console.warn(`    ⚠️ Region starts at ${regionStart.toFixed(3)}s but waveform only has ${waveformDuration.toFixed(3)}s - SKIPPING (merged file is incomplete)`);
            } else if (regionEnd > waveformDuration) {
              console.warn(`    ⚠️ Region ends at ${regionEnd.toFixed(3)}s but waveform only has ${waveformDuration.toFixed(3)}s - CLIPPING to fit`);
              // Add region but clip it to waveform duration
              regionsPlugin.addRegion({
                id: `${trackIndex}-${segments[segmentIndex].id}`,
                start: regionStart,
                end: waveformDuration - 0.001, // Slightly before end to ensure visibility
                color: color,
                drag: false,
                resize: false,
              });
            } else {
              // Add region normally
              regionsPlugin.addRegion({
                id: `${trackIndex}-${segments[segmentIndex].id}`,
                start: regionStart,
                end: regionEnd,
                color: color,
                drag: false,
                resize: false,
              });
            }
          } else {
            console.warn(`    ⚠️ No matching segment found for ${segmentFile.start}-${segmentFile.end}`);
          }

          currentPosition += segmentFile.duration;
        });

        console.log(`  Total duration: ${currentPosition.toFixed(3)}s\n`);
      } else {
        // For source track: add regions at original timeline positions
        segments.forEach((segment, segmentIndex) => {
          regionsPlugin.addRegion({
            id: `${trackIndex}-${segment.id}`,
            start: segment.start,
            end: segment.end,
            color: getSegmentColor(segmentIndex),
            drag: false,  // Disable dragging in preview tab
            resize: false, // Disable resizing in preview tab
          });
        });
      }
    });
  }, [
    segments,
    readyStates,
    // Only re-create regions if track count or segment files change
    // NOT when volume/mute changes
    tracks.length,
    tracks.map(t => t.segmentFiles?.length || 0).join(','),
  ]);

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

  // Removed track status rendering - no kings/princes distinction

  return (
    <div className={`multi-track-waveform ${className}`}>
      {/* Track List */}
      {tracks.map((track, index) => (
        <div
          key={index}
          className={`audio-track ${currentlyPlayingTrack === index ? 'currently-playing' : ''}`}
        >
          {/* Track Header */}
          <div className="track-header">
            <div className="track-label">
              <strong>{getTrackLabel(index)}</strong>
              {currentlyPlayingTrack === index && (
                <span className="playing-indicator"> ▶ Playing</span>
              )}
            </div>
            <div className="track-controls">
              {/* Enabled/Disabled Toggle */}
              <label className="enabled-control">
                <input
                  type="checkbox"
                  checked={!track.muted}
                  onChange={(e) => handleMuteChange(index, !e.target.checked)}
                />
                Enabled
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
            {!track.url && (!track.segmentFiles || track.segmentFiles.length === 0) && (
              <div className="no-audio-placeholder">
                <p>No audio file for this track</p>
              </div>
            )}
            {(track.url || (track.segmentFiles && track.segmentFiles.length > 0)) && !readyStates[index] && (
              <div className="loading-placeholder">
                <p>Loading waveform...</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
});

MultiTrackWaveform.displayName = "MultiTrackWaveform";

export default MultiTrackWaveform;
