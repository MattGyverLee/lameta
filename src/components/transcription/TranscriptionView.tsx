/**
 * TranscriptionView - Main container for transcription tools
 * Provides two-tab interface: Annotate (SayMore-inspired) and Preview (Prestige-inspired)
 */

import React, { useState, useEffect } from "react";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";
import "./TranscriptionView.css";

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
   * TODO: Implement actual ELAN file parsing using xml2js
   */
  const loadEafFile = async (filePath: string) => {
    console.log(`Loading ELAN file: ${filePath}`);
    // TODO: Parse ELAN XML file and populate segments
  };

  /**
   * Save to ELAN .eaf file
   * TODO: Implement actual ELAN file writing
   */
  const saveEafFile = async () => {
    console.log("Auto-saving ELAN file...");
    // TODO: Write segments to ELAN XML format
    setState((prev) => ({ ...prev, hasUnsavedChanges: false }));
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
  const handleStartSegmentation = () => {
    setState((prev) => ({ ...prev, isSegmenting: true }));
    // TODO: Implement Web Audio API segmentation in Web Worker
    console.log("Starting auto-segmentation...");
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
