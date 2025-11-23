/**
 * AnnotateTab - SayMore-inspired transcription interface
 * Provides video playback, waveform, segmentation tools, and annotation grid
 */

import React from "react";
import "./AnnotateTab.css";
import VideoPlayerSection from "../shared/VideoPlayerSection";
import {
  AnnotationSegment,
  PlaybackState,
} from "../shared/types";

/**
 * Props for AnnotateTab component
 */
interface AnnotateTabProps {
  mediaFilePath: string;
  segments: AnnotationSegment[];
  selectedSegmentId?: string;
  playback: PlaybackState;
  isSegmenting: boolean;

  onSegmentSelect: (segmentId: string | undefined) => void;
  onSegmentUpdate: (segmentId: string, field: keyof AnnotationSegment, value: string) => void;
  onSegmentBoundaryChange: (segmentId: string, newStart: number, newEnd: number) => void;
  onTogglePlay: () => void;
  onProgress: (currentTime: number) => void;
  onDuration: (duration: number) => void;
  onStartSegmentation: () => void;
}

/**
 * AnnotateTab Component
 */
export const AnnotateTab: React.FC<AnnotateTabProps> = ({
  mediaFilePath,
  segments,
  selectedSegmentId,
  playback,
  isSegmenting,
  onSegmentSelect,
  onSegmentUpdate,
  onSegmentBoundaryChange,
  onTogglePlay,
  onProgress,
  onDuration,
  onStartSegmentation,
}) => {
  /**
   * Handle segment click from waveform
   */
  const handleSegmentClick = (segmentId: string) => {
    onSegmentSelect(segmentId);
  };

  /**
   * Handle segment play (double-click)
   */
  const handleSegmentPlay = (segmentId: string) => {
    const segment = segments.find((s) => s.id === segmentId);
    if (segment) {
      // TODO: Set loop region to segment boundaries and play
      console.log(`Playing segment: ${segmentId}`);
    }
  };

  return (
    <div className="annotate-tab">
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

      {/* Segmentation Toolbar */}
      <div className="segmentation-toolbar">
        <button
          onClick={onStartSegmentation}
          disabled={isSegmenting}
          className="btn-segment"
        >
          {isSegmenting ? "Segmenting..." : "Auto-Segment"}
        </button>
        <button className="btn-add-segment">Add Segment</button>
        <button className="btn-delete-segment" disabled={!selectedSegmentId}>
          Delete Segment
        </button>
        <button className="btn-split-segment" disabled={!selectedSegmentId}>
          Split Segment
        </button>
        <button className="btn-merge-segments" disabled={!selectedSegmentId}>
          Merge Segments
        </button>
      </div>

      {/* Waveform Section */}
      <div className="waveform-section">
        <div className="waveform-placeholder">
          <p>Waveform Visualization (WaveSurfer.js)</p>
          <p>Segments: {segments.length}</p>
          <p>Selected: {selectedSegmentId || "None"}</p>
        </div>
      </div>

      {/* Annotation Grid Section */}
      <div className="annotation-grid-section">
        <table className="annotation-grid">
          <thead>
            <tr>
              <th style={{ width: "80px" }}>Start</th>
              <th style={{ width: "80px" }}>End</th>
              <th style={{ width: "80px" }}>Length</th>
              <th>Transcription</th>
              <th>Translation</th>
              <th style={{ width: "60px" }}>Audio</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((segment) => (
              <tr
                key={segment.id}
                className={segment.id === selectedSegmentId ? "selected" : ""}
                onClick={() => handleSegmentClick(segment.id)}
                onDoubleClick={() => handleSegmentPlay(segment.id)}
              >
                <td>{segment.start.toFixed(2)}</td>
                <td>{segment.end.toFixed(2)}</td>
                <td>{(segment.end - segment.start).toFixed(2)}</td>
                <td>
                  <input
                    type="text"
                    value={segment.text}
                    onChange={(e) =>
                      onSegmentUpdate(segment.id, "text", e.target.value)
                    }
                    placeholder="Enter transcription..."
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={segment.translation || ""}
                    onChange={(e) =>
                      onSegmentUpdate(segment.id, "translation", e.target.value)
                    }
                    placeholder="Enter translation..."
                  />
                </td>
                <td className="audio-buttons">
                  <button className="btn-record" title="Record careful speech">
                    🎤
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

export default AnnotateTab;
