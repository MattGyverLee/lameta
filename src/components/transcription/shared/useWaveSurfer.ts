/**
 * useWaveSurfer - Custom hook for managing WaveSurfer.js instances
 * Handles waveform visualization with segment regions
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { AnnotationSegment } from "./types";

// WaveSurfer types (will be imported once installed)
// import WaveSurfer from "wavesurfer.js";
// import RegionsPlugin from "wavesurfer.js/dist/plugins/regions";

/**
 * Configuration options for useWaveSurfer hook
 */
export interface UseWaveSurferOptions {
  /** Container element for the waveform */
  container: HTMLElement | null;

  /** Audio URL to load */
  audioUrl: string;

  /** Annotation segments to display as regions */
  segments?: AnnotationSegment[];

  /** Currently selected segment ID */
  selectedSegmentId?: string;

  /** Waveform color */
  waveColor?: string;

  /** Progress color */
  progressColor?: string;

  /** Height of waveform in pixels */
  height?: number;

  /** Callback when a region is clicked */
  onRegionClick?: (segmentId: string) => void;

  /** Callback when a region boundary is updated */
  onRegionUpdate?: (segmentId: string, newStart: number, newEnd: number) => void;

  /** Callback when waveform is ready */
  onReady?: () => void;
}

/**
 * Return type for useWaveSurfer hook
 */
export interface UseWaveSurferReturn {
  /** WaveSurfer instance (null until initialized) */
  wavesurfer: any | null;

  /** Whether waveform is currently loading */
  isLoading: boolean;

  /** Whether waveform is ready */
  isReady: boolean;

  /** Current playback time */
  currentTime: number;

  /** Total duration */
  duration: number;

  /** Play/pause the waveform */
  togglePlay: () => void;

  /** Seek to specific time */
  seekTo: (time: number) => void;

  /** Zoom in/out */
  zoom: (level: number) => void;
}

/**
 * Custom hook for managing WaveSurfer.js instances
 *
 * @example
 * ```tsx
 * const { wavesurfer, isReady } = useWaveSurfer({
 *   container: containerRef.current,
 *   audioUrl: "/path/to/audio.wav",
 *   segments: annotationSegments,
 *   onRegionClick: (id) => handleSegmentSelect(id)
 * });
 * ```
 */
export const useWaveSurfer = (options: UseWaveSurferOptions): UseWaveSurferReturn => {
  const {
    container,
    audioUrl,
    segments = [],
    selectedSegmentId,
    waveColor = "#94c397",
    progressColor = "#e69664",
    height = 128,
    onRegionClick,
    onRegionUpdate,
    onReady,
  } = options;

  const wavesurferRef = useRef<any>(null);
  const regionsPluginRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  /**
   * Initialize WaveSurfer instance
   */
  useEffect(() => {
    if (!container || !audioUrl) return;

    // Clean up previous instance
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }

    setIsLoading(true);
    setIsReady(false);

    // TODO: Initialize WaveSurfer when installed
    // This is a placeholder that will be implemented once wavesurfer.js is installed

    // Example implementation (will uncomment once WaveSurfer.js is installed):
    /*
    const regionsPlugin = RegionsPlugin.create({
      dragSelection: false, // Disable drag-to-select
    });

    const ws = WaveSurfer.create({
      container,
      waveColor,
      progressColor,
      height,
      barWidth: 2,
      barGap: 1,
      plugins: [regionsPlugin],
    });

    ws.load(audioUrl);

    ws.on("ready", () => {
      setIsReady(true);
      setIsLoading(false);
      setDuration(ws.getDuration());
      if (onReady) onReady();
    });

    ws.on("audioprocess", (time: number) => {
      setCurrentTime(time);
    });

    ws.on("seek", (progress: number) => {
      setCurrentTime(ws.getDuration() * progress);
    });

    wavesurferRef.current = ws;
    regionsPluginRef.current = regionsPlugin;
    */

    // Temporary: Mark as "ready" after a short delay for testing
    const timer = setTimeout(() => {
      setIsReady(true);
      setIsLoading(false);
      console.log("WaveSurfer placeholder initialized");
    }, 500);

    return () => {
      clearTimeout(timer);
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
    };
  }, [container, audioUrl, waveColor, progressColor, height, onReady]);

  /**
   * Update regions when segments change
   */
  useEffect(() => {
    if (!wavesurferRef.current || !regionsPluginRef.current || !isReady) return;

    // TODO: Update regions when WaveSurfer.js is installed
    // This will create visual regions for each segment

    /*
    // Clear existing regions
    regionsPluginRef.current.clearRegions();

    // Add new regions for each segment
    segments.forEach((segment) => {
      const region = regionsPluginRef.current.addRegion({
        id: segment.id,
        start: segment.start,
        end: segment.end,
        color: segment.id === selectedSegmentId
          ? "rgba(230, 150, 100, 0.3)" // Selected color
          : "rgba(207, 240, 159, 0.3)", // Session color
        drag: true,
        resize: true,
      });

      // Handle region click
      region.on("click", () => {
        if (onRegionClick) {
          onRegionClick(segment.id);
        }
      });

      // Handle region update (drag/resize)
      region.on("update-end", () => {
        if (onRegionUpdate) {
          onRegionUpdate(segment.id, region.start, region.end);
        }
      });
    });
    */

    console.log(`Regions placeholder: ${segments.length} segments`);
  }, [segments, selectedSegmentId, isReady, onRegionClick, onRegionUpdate]);

  /**
   * Toggle play/pause
   */
  const togglePlay = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  }, []);

  /**
   * Seek to specific time
   */
  const seekTo = useCallback((time: number) => {
    if (wavesurferRef.current && duration > 0) {
      const progress = time / duration;
      wavesurferRef.current.seekTo(progress);
    }
  }, [duration]);

  /**
   * Zoom waveform
   */
  const zoom = useCallback((level: number) => {
    if (wavesurferRef.current) {
      wavesurferRef.current.zoom(level);
    }
  }, []);

  return {
    wavesurfer: wavesurferRef.current,
    isLoading,
    isReady,
    currentTime,
    duration,
    togglePlay,
    seekTo,
    zoom,
  };
};

export default useWaveSurfer;
