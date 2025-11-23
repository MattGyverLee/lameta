/**
 * WaveformSection - Waveform visualization component
 * Uses useWaveSurfer hook to display audio waveform with segment regions
 */

import React, { useRef, useEffect } from "react";
import { useWaveSurfer } from "./useWaveSurfer";
import { WaveformSectionProps } from "./types";
import "./WaveformSection.css";

/**
 * WaveformSection Component
 *
 * Displays an audio waveform with visual regions for annotation segments.
 * Supports:
 * - Interactive region selection
 * - Drag-to-adjust segment boundaries
 * - Zoom controls
 * - Synchronized playback with video
 */
export const WaveformSection: React.FC<WaveformSectionProps> = ({
  audioUrl,
  segments,
  selectedSegmentId,
  currentTime,
  onSegmentClick,
  onSegmentBoundaryChange,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = React.useState(0);

  const {
    wavesurfer,
    isLoading,
    isReady,
    currentTime: waveformTime,
    duration,
    togglePlay,
    seekTo,
    zoom,
  } = useWaveSurfer({
    container: containerRef.current,
    audioUrl,
    segments,
    selectedSegmentId,
    waveColor: "#94c397",
    progressColor: "#e69664",
    height: 128,
    onRegionClick,
    onRegionUpdate: onSegmentBoundaryChange,
    onReady: () => {
      console.log("Waveform ready");
    },
  });

  /**
   * Sync waveform position with external currentTime (from video player)
   */
  useEffect(() => {
    if (wavesurfer && currentTime !== undefined && duration > 0) {
      const timeDiff = Math.abs(waveformTime - currentTime);
      // Only seek if difference is significant to avoid feedback loop
      if (timeDiff > 0.5) {
        seekTo(currentTime);
      }
    }
  }, [currentTime, wavesurfer, waveformTime, duration, seekTo]);

  /**
   * Handle zoom in
   */
  const handleZoomIn = () => {
    const newLevel = Math.min(zoomLevel + 10, 200);
    setZoomLevel(newLevel);
    zoom(newLevel);
  };

  /**
   * Handle zoom out
   */
  const handleZoomOut = () => {
    const newLevel = Math.max(zoomLevel - 10, 0);
    setZoomLevel(newLevel);
    zoom(newLevel);
  };

  /**
   * Handle zoom reset
   */
  const handleZoomReset = () => {
    setZoomLevel(0);
    zoom(0);
  };

  return (
    <div className={`waveform-section ${className}`}>
      {/* Toolbar */}
      <div className="waveform-toolbar">
        <div className="waveform-info">
          {isLoading && <span className="waveform-status">Loading...</span>}
          {isReady && (
            <span className="waveform-status">
              Duration: {duration.toFixed(2)}s | Segments: {segments.length}
            </span>
          )}
        </div>
        <div className="waveform-controls">
          <button
            onClick={handleZoomOut}
            disabled={zoomLevel <= 0}
            className="zoom-btn"
            title="Zoom out"
          >
            −
          </button>
          <button
            onClick={handleZoomReset}
            disabled={zoomLevel === 0}
            className="zoom-btn"
            title="Reset zoom"
          >
            Reset
          </button>
          <button
            onClick={handleZoomIn}
            disabled={zoomLevel >= 200}
            className="zoom-btn"
            title="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {/* Waveform Container */}
      <div
        ref={containerRef}
        className="waveform-container"
        style={{ minHeight: "128px" }}
      >
        {!isReady && !isLoading && (
          <div className="waveform-placeholder">
            <p>Waveform will appear here</p>
            <p className="waveform-placeholder-detail">
              Audio: {audioUrl.split("/").pop()}
            </p>
          </div>
        )}
      </div>

      {/* Segment Info */}
      {selectedSegmentId && (
        <div className="segment-info">
          {(() => {
            const segment = segments.find((s) => s.id === selectedSegmentId);
            if (!segment) return null;
            return (
              <div className="segment-info-content">
                <span className="segment-info-label">Selected:</span>
                <span className="segment-info-time">
                  {segment.start.toFixed(2)}s - {segment.end.toFixed(2)}s
                </span>
                <span className="segment-info-duration">
                  ({(segment.end - segment.start).toFixed(2)}s)
                </span>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default WaveformSection;
