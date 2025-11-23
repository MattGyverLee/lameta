/**
 * AnnotateTab - SayMore-inspired transcription interface
 * Provides video playback, waveform, segmentation tools, and annotation grid
 */

import React from "react";
import "./AnnotateTab.css";
import VideoPlayerSection from "../shared/VideoPlayerSection";
import WaveformSection from "../shared/WaveformSection";
import useKeyboardShortcuts from "../shared/useKeyboardShortcuts";
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
  onAddSegment: () => void;
  onDeleteSegment: () => void;
  onSplitSegment: () => void;
  onMergeSegments: () => void;
  onSave: () => void;
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
  onAddSegment,
  onDeleteSegment,
  onSplitSegment,
  onMergeSegments,
  onSave,
}) => {
  /**
   * Handle segment click from waveform
   */
  const handleSegmentClick = (segmentId: string) => {
    onSegmentSelect(segmentId);
  };

  /**
   * Handle segment play (double-click or F2 key)
   */
  const handleSegmentPlay = (segmentId?: string) => {
    const targetId = segmentId || selectedSegmentId;
    if (!targetId) return;

    const segment = segments.find((s) => s.id === targetId);
    if (segment) {
      // Seek to segment start
      onProgress(segment.start);
      // Play if not already playing
      if (!playback.playing) {
        onTogglePlay();
      }
      console.log(`Playing segment: ${targetId} (${segment.start}s - ${segment.end}s)`);
    }
  };

  /**
   * Navigate to next segment
   */
  const handleNextSegment = () => {
    if (!selectedSegmentId || segments.length === 0) {
      // Select first segment if none selected
      if (segments.length > 0) {
        onSegmentSelect(segments[0].id);
      }
      return;
    }

    const currentIndex = segments.findIndex((s) => s.id === selectedSegmentId);
    if (currentIndex < segments.length - 1) {
      onSegmentSelect(segments[currentIndex + 1].id);
    }
  };

  /**
   * Navigate to previous segment
   */
  const handlePreviousSegment = () => {
    if (!selectedSegmentId || segments.length === 0) return;

    const currentIndex = segments.findIndex((s) => s.id === selectedSegmentId);
    if (currentIndex > 0) {
      onSegmentSelect(segments[currentIndex - 1].id);
    }
  };

  /**
   * Enable keyboard shortcuts
   */
  useKeyboardShortcuts({
    enabled: true,
    onPlayPause: onTogglePlay,
    onPlaySegment: () => handleSegmentPlay(),
    onSave: onSave,
    onAddSegment: onAddSegment,
    onDeleteSegment: onDeleteSegment,
    onSplitSegment: onSplitSegment,
    onMergeSegments: onMergeSegments,
    onNextSegment: handleNextSegment,
    onPreviousSegment: handlePreviousSegment,
    onAutoSegment: onStartSegmentation,
  });

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
          title="Auto-segment audio (Ctrl+Shift+A)"
        >
          {isSegmenting ? "Segmenting..." : "Auto-Segment"}
        </button>
        <button onClick={onAddSegment} className="btn-add-segment" title="Add new segment (Ctrl+N)">
          Add Segment
        </button>
        <button
          onClick={onDeleteSegment}
          disabled={!selectedSegmentId}
          className="btn-delete-segment"
          title="Delete selected segment (Ctrl+D)"
        >
          Delete Segment
        </button>
        <button
          onClick={onSplitSegment}
          disabled={!selectedSegmentId}
          className="btn-split-segment"
          title="Split segment at current time (Ctrl+T)"
        >
          Split Segment
        </button>
        <button
          onClick={onMergeSegments}
          disabled={!selectedSegmentId}
          className="btn-merge-segments"
          title="Merge with next segment (Ctrl+M)"
        >
          Merge Segments
        </button>
        <div className="keyboard-shortcuts-hint" style={{ marginLeft: "auto", fontSize: "0.85em", color: "#666" }}>
          Shortcuts: Space=Play/Pause | F2=Play segment | Tab=Next | Ctrl+S=Save
        </div>
      </div>

      {/* Waveform Section */}
      <div className="waveform-wrapper">
        <WaveformSection
          audioUrl={mediaFilePath}
          segments={segments}
          selectedSegmentId={selectedSegmentId}
          currentTime={playback.currentTime}
          onSegmentClick={handleSegmentClick}
          onSegmentBoundaryChange={onSegmentBoundaryChange}
        />
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
        {playback.loop && playback.loopRegion && (
          <span className="loop-indicator" title="Auto-looping selected segment">
            🔁 Loop: {playback.loopRegion.start.toFixed(1)}s - {playback.loopRegion.end.toFixed(1)}s
          </span>
        )}
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
