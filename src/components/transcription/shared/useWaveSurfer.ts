/**
 * useWaveSurfer - Custom hook for managing WaveSurfer.js instances
 * Handles waveform visualization with segment regions
 */

import { useEffect, useRef, useState, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions";
import type { AnnotationSegment } from "./types";

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
  const onReadyRef = useRef(onReady);

  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Update ref when callback changes
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  /**
   * Initialize WaveSurfer instance
   */
  useEffect(() => {
    if (!container || !audioUrl) {
      console.log("Skipping WaveSurfer init - missing container or audioUrl");
      return;
    }

    let mounted = true;

    // Clean up previous instance
    if (wavesurferRef.current) {
      console.log("Destroying previous WaveSurfer instance");
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }

    setIsLoading(true);
    setIsReady(false);

    // Initialize WaveSurfer with Regions plugin
    const regionsPlugin = RegionsPlugin.create();

    const ws = WaveSurfer.create({
      container,
      waveColor,
      progressColor,
      height,
      barWidth: 2,
      barGap: 1,
      plugins: [regionsPlugin],
    });

    console.log(`Loading waveform from: ${audioUrl}`);
    ws.load(audioUrl);

    ws.on("ready", () => {
      if (!mounted) return;
      console.log("WaveSurfer ready event fired");
      setIsReady(true);
      setIsLoading(false);
      setDuration(ws.getDuration());
      if (onReadyRef.current) onReadyRef.current();
    });

    ws.on("error", (error: any) => {
      if (!mounted) return;
      console.error("WaveSurfer error:", error);
      setIsLoading(false);
      setIsReady(false);
    });

    ws.on("audioprocess", (time: number) => {
      if (!mounted) return;
      setCurrentTime(time);
    });

    ws.on("interaction" as any, () => {
      if (!mounted) return;
      setCurrentTime(ws.getCurrentTime());
    });

    wavesurferRef.current = ws;
    regionsPluginRef.current = regionsPlugin;

    return () => {
      mounted = false;
      // Don't destroy immediately - let it finish loading
      setTimeout(() => {
        if (wavesurferRef.current === ws) {
          ws.destroy();
        }
      }, 100);
    };
  }, [container, audioUrl]); // Remove unstable callbacks from deps to prevent infinite re-render

  /**
   * Get color for segment region (rainbow palette like Prestige)
   */
  const getSegmentColor = (index: number, isSelected: boolean): string => {
    if (isSelected) {
      return "rgba(255, 140, 0, 0.4)"; // Bright orange for selection
    }

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
   * Update regions when segments change
   */
  useEffect(() => {
    if (!wavesurferRef.current || !regionsPluginRef.current || !isReady) return;

    // Clear existing regions
    regionsPluginRef.current.clearRegions();

    // Add new regions for each segment
    segments.forEach((segment, index) => {
      const isSelected = segment.id === selectedSegmentId;
      const region = regionsPluginRef.current.addRegion({
        id: segment.id,
        start: segment.start,
        end: segment.end,
        color: getSegmentColor(index, isSelected),
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
