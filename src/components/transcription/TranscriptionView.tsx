/**
 * TranscriptionView - Main container for transcription tools
 * Provides two-tab interface: Annotate (SayMore-inspired) and Preview (Prestige-inspired)
 */

import React, { useState, useEffect } from "react";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";
import "./TranscriptionView.css";
import * as ElanFileHandler from "../../model/file/ElanFileHandler";
import * as AutoSegmenter from "./shared/AutoSegmenter";

import AnnotateTab from "./AnnotateTab/AnnotateTab";
import PreviewTab from "./PreviewTab/PreviewTab";
import {
  TranscriptionViewProps,
  TranscriptionState,
  AnnotationSegment,
  PlaybackState,
  SegmentationSettings,
} from "./shared/types";

/**
 * Default segmentation settings based on SayMore
 */
const DEFAULT_SEGMENTATION_SETTINGS: SegmentationSettings = {
  minimumSegmentLengthMs: 500,
  maximumSegmentLengthMs: 10000,
  preferredPauseLengthMs: 300,
  optimumLengthClampingFactor: 0.85,
  silenceThresholdDb: -40,
};

/**
 * Default playback state
 */
const DEFAULT_PLAYBACK_STATE: PlaybackState = {
  playing: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 1.0,
  loop: false,
  volume: 1.0,
  muted: false,
};

/**
 * Create mock segments for initial testing
 * TODO: Replace with actual ELAN file loading
 */
const createMockSegments = (): AnnotationSegment[] => {
  return [
    {
      id: "seg-1",
      start: 0.0,
      end: 3.5,
      text: "",
      translation: "",
    },
    {
      id: "seg-2",
      start: 3.5,
      end: 7.2,
      text: "",
      translation: "",
    },
    {
      id: "seg-3",
      start: 7.2,
      end: 11.8,
      text: "",
      translation: "",
    },
  ];
};

/**
 * TranscriptionView Component
 */
export const TranscriptionView: React.FC<TranscriptionViewProps> = ({
  mediaFilePath,
  eafFilePath,
  onClose,
}) => {
  // Initialize state
  const [state, setState] = useState<TranscriptionState>(() => ({
    mediaFilePath,
    eafFilePath,
    segments: createMockSegments(),
    selectedSegmentId: undefined,
    playback: DEFAULT_PLAYBACK_STATE,
    audioTracks: [],
    segmentationSettings: DEFAULT_SEGMENTATION_SETTINGS,
    autoSaveEnabled: true,
    hasUnsavedChanges: false,
    isSegmenting: false,
    isExporting: false,
  }));

  const [activeTabIndex, setActiveTabIndex] = useState(0);

  // Load ELAN file if it exists
  useEffect(() => {
    if (eafFilePath) {
      loadEafFile(eafFilePath);
    }
  }, [eafFilePath]);

  // Auto-save handler
  useEffect(() => {
    if (state.autoSaveEnabled && state.hasUnsavedChanges) {
      const timer = setTimeout(() => {
        saveEafFile();
      }, 30000); // 30 seconds

      return () => clearTimeout(timer);
    }
  }, [state.autoSaveEnabled, state.hasUnsavedChanges]);

  /**
   * Load ELAN .eaf file
   */
  const loadEafFile = async (filePath: string) => {
    try {
      console.log(`Loading ELAN file: ${filePath}`);
      const segments = await ElanFileHandler.loadElanFile(filePath);
      setState((prev) => ({
        ...prev,
        segments,
        hasUnsavedChanges: false,
      }));
      console.log(`Loaded ${segments.length} segments from ELAN file`);
    } catch (error) {
      console.error("Failed to load ELAN file:", error);
      // Keep using mock segments if load fails
    }
  };

  /**
   * Save to ELAN .eaf file
   */
  const saveEafFile = async () => {
    try {
      const eafPath = state.eafFilePath || ElanFileHandler.getElanFilePath(state.mediaFilePath);
      console.log(`Saving ELAN file: ${eafPath}`);
      await ElanFileHandler.saveElanFile(eafPath, state.segments, state.mediaFilePath);
      setState((prev) => ({ ...prev, hasUnsavedChanges: false, eafFilePath: eafPath }));
      console.log("ELAN file saved successfully");
    } catch (error) {
      console.error("Failed to save ELAN file:", error);
    }
  };

  /**
   * Update segments
   */
  const handleSegmentsChange = (segments: AnnotationSegment[]) => {
    setState((prev) => ({
      ...prev,
      segments,
      hasUnsavedChanges: true,
    }));
  };

  /**
   * Select a segment
   */
  const handleSegmentSelect = (segmentId: string | undefined) => {
    setState((prev) => ({ ...prev, selectedSegmentId: segmentId }));
  };

  /**
   * Update playback state
   */
  const handlePlaybackChange = (changes: Partial<PlaybackState>) => {
    setState((prev) => ({
      ...prev,
      playback: { ...prev.playback, ...changes },
    }));
  };

  /**
   * Toggle play/pause
   */
  const handleTogglePlay = () => {
    setState((prev) => ({
      ...prev,
      playback: { ...prev.playback, playing: !prev.playback.playing },
    }));
  };

  /**
   * Update playback time
   */
  const handleProgress = (currentTime: number) => {
    setState((prev) => ({
      ...prev,
      playback: { ...prev.playback, currentTime },
    }));
  };

  /**
   * Set duration when media is loaded
   */
  const handleDuration = (duration: number) => {
    setState((prev) => ({
      ...prev,
      playback: { ...prev.playback, duration },
    }));
  };

  /**
   * Update a segment
   */
  const handleSegmentUpdate = (
    segmentId: string,
    field: keyof AnnotationSegment,
    value: string
  ) => {
    const updatedSegments = state.segments.map((seg) =>
      seg.id === segmentId ? { ...seg, [field]: value } : seg
    );
    handleSegmentsChange(updatedSegments);
  };

  /**
   * Update segment boundaries (from waveform dragging)
   */
  const handleSegmentBoundaryChange = (
    segmentId: string,
    newStart: number,
    newEnd: number
  ) => {
    const updatedSegments = state.segments.map((seg) =>
      seg.id === segmentId ? { ...seg, start: newStart, end: newEnd } : seg
    );
    handleSegmentsChange(updatedSegments);
  };

  /**
   * Start auto-segmentation
   */
  const handleStartSegmentation = async () => {
    setState((prev) => ({ ...prev, isSegmenting: true }));

    try {
      console.log("Starting auto-segmentation...");
      const segments = await AutoSegmenter.autoSegmentMediaFile(
        state.mediaFilePath,
        state.segmentationSettings
      );

      // Update state with new segments
      setState((prev) => ({
        ...prev,
        segments,
        isSegmenting: false,
        hasUnsavedChanges: true,
      }));

      console.log(`Auto-segmentation complete: ${segments.length} segments created`);
    } catch (error) {
      console.error("Auto-segmentation failed:", error);
      setState((prev) => ({ ...prev, isSegmenting: false }));
    }
  };

  /**
   * Add a new segment at current playback time
   */
  const handleAddSegment = () => {
    const currentTime = state.playback.currentTime;
    const duration = state.playback.duration;
    const newSegmentId = `seg-${Date.now()}`;

    // Default new segment: 3 seconds from current time
    const newSegment: AnnotationSegment = {
      id: newSegmentId,
      start: currentTime,
      end: Math.min(currentTime + 3, duration),
      text: "",
      translation: "",
    };

    const updatedSegments = [...state.segments, newSegment].sort((a, b) => a.start - b.start);
    handleSegmentsChange(updatedSegments);
    handleSegmentSelect(newSegmentId);
  };

  /**
   * Delete the currently selected segment
   */
  const handleDeleteSegment = () => {
    if (!state.selectedSegmentId) return;

    const updatedSegments = state.segments.filter((seg) => seg.id !== state.selectedSegmentId);
    handleSegmentsChange(updatedSegments);
    handleSegmentSelect(undefined);
  };

  /**
   * Split the currently selected segment at current playback time
   */
  const handleSplitSegment = () => {
    if (!state.selectedSegmentId) return;

    const currentTime = state.playback.currentTime;
    const selectedSegment = state.segments.find((seg) => seg.id === state.selectedSegmentId);

    if (!selectedSegment) return;

    // Only split if current time is within the segment
    if (currentTime <= selectedSegment.start || currentTime >= selectedSegment.end) {
      console.warn("Current time is not within the selected segment");
      return;
    }

    // Create two new segments
    const newSegmentId = `seg-${Date.now()}`;
    const firstPart: AnnotationSegment = {
      ...selectedSegment,
      end: currentTime,
    };
    const secondPart: AnnotationSegment = {
      id: newSegmentId,
      start: currentTime,
      end: selectedSegment.end,
      text: "",
      translation: "",
    };

    const updatedSegments = state.segments
      .map((seg) => (seg.id === state.selectedSegmentId ? firstPart : seg))
      .concat(secondPart)
      .sort((a, b) => a.start - b.start);

    handleSegmentsChange(updatedSegments);
    handleSegmentSelect(newSegmentId);
  };

  /**
   * Merge the currently selected segment with the next segment
   */
  const handleMergeSegments = () => {
    if (!state.selectedSegmentId) return;

    const currentIndex = state.segments.findIndex((seg) => seg.id === state.selectedSegmentId);
    if (currentIndex === -1 || currentIndex === state.segments.length - 1) {
      console.warn("Cannot merge: no next segment");
      return;
    }

    const currentSegment = state.segments[currentIndex];
    const nextSegment = state.segments[currentIndex + 1];

    // Merge into a single segment
    const mergedSegment: AnnotationSegment = {
      ...currentSegment,
      end: nextSegment.end,
      text: `${currentSegment.text} ${nextSegment.text}`.trim(),
      translation: `${currentSegment.translation || ""} ${nextSegment.translation || ""}`.trim(),
    };

    const updatedSegments = state.segments
      .filter((seg) => seg.id !== nextSegment.id)
      .map((seg) => (seg.id === currentSegment.id ? mergedSegment : seg));

    handleSegmentsChange(updatedSegments);
  };

  return (
    <div className="transcription-view">
      {/* Header */}
      <div className="transcription-header">
        <h2 className="transcription-title">
          Transcription: {mediaFilePath.split("/").pop()}
        </h2>
        <div className="transcription-actions">
          {state.hasUnsavedChanges && (
            <span className="unsaved-indicator">● Unsaved changes</span>
          )}
          <button onClick={saveEafFile} className="btn-save">
            Save
          </button>
          <button onClick={onClose} className="btn-close">
            Close
          </button>
        </div>
      </div>

      {/* Two-tab interface */}
      <Tabs
        className="transcription-tabs"
        selectedIndex={activeTabIndex}
        onSelect={(index) => setActiveTabIndex(index)}
      >
        <TabList className="transcription-tab-list">
          <Tab className="transcription-tab" selectedClassName="selected">
            Annotate
          </Tab>
          <Tab className="transcription-tab" selectedClassName="selected">
            Preview
          </Tab>
        </TabList>

        {/* Annotate Tab - SayMore-inspired transcription interface */}
        <TabPanel className="transcription-tab-panel">
          <AnnotateTab
            mediaFilePath={state.mediaFilePath}
            segments={state.segments}
            selectedSegmentId={state.selectedSegmentId}
            playback={state.playback}
            onSegmentSelect={handleSegmentSelect}
            onSegmentUpdate={handleSegmentUpdate}
            onSegmentBoundaryChange={handleSegmentBoundaryChange}
            onTogglePlay={handleTogglePlay}
            onProgress={handleProgress}
            onDuration={handleDuration}
            onStartSegmentation={handleStartSegmentation}
            onAddSegment={handleAddSegment}
            onDeleteSegment={handleDeleteSegment}
            onSplitSegment={handleSplitSegment}
            onMergeSegments={handleMergeSegments}
            isSegmenting={state.isSegmenting}
          />
        </TabPanel>

        {/* Preview Tab - Prestige-inspired multi-layer playback */}
        <TabPanel className="transcription-tab-panel">
          <PreviewTab
            mediaFilePath={state.mediaFilePath}
            segments={state.segments}
            audioTracks={state.audioTracks}
            playback={state.playback}
            onTogglePlay={handleTogglePlay}
            onProgress={handleProgress}
            onDuration={handleDuration}
          />
        </TabPanel>
      </Tabs>
    </div>
  );
};

export default TranscriptionView;
