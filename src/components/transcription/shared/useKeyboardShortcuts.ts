/**
 * useKeyboardShortcuts - Custom hook for transcription keyboard shortcuts
 * Implements SayMore-inspired keyboard navigation for efficient transcription workflow
 */

import { useEffect } from "react";

/**
 * Configuration for keyboard shortcuts
 */
export interface KeyboardShortcutsConfig {
  /** Whether shortcuts are enabled */
  enabled?: boolean;

  /** Callback for play/pause (Space) */
  onPlayPause?: () => void;

  /** Callback for play selected segment (F2) */
  onPlaySegment?: () => void;

  /** Callback for save (Ctrl+S) */
  onSave?: () => void;

  /** Callback for add segment (Ctrl+N) */
  onAddSegment?: () => void;

  /** Callback for delete segment (Ctrl+D) */
  onDeleteSegment?: () => void;

  /** Callback for split segment (Ctrl+T) */
  onSplitSegment?: () => void;

  /** Callback for merge segments (Ctrl+M) */
  onMergeSegments?: () => void;

  /** Callback for next segment (Tab) */
  onNextSegment?: () => void;

  /** Callback for previous segment (Shift+Tab) */
  onPreviousSegment?: () => void;

  /** Callback for auto-segment (Ctrl+Shift+A) */
  onAutoSegment?: () => void;
}

/**
 * Custom hook for keyboard shortcuts in transcription interface
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts({
 *   enabled: true,
 *   onPlayPause: handleTogglePlay,
 *   onSave: handleSave,
 *   onAddSegment: handleAddSegment,
 * });
 * ```
 */
export const useKeyboardShortcuts = (config: KeyboardShortcutsConfig) => {
  const {
    enabled = true,
    onPlayPause,
    onPlaySegment,
    onSave,
    onAddSegment,
    onDeleteSegment,
    onSplitSegment,
    onMergeSegments,
    onNextSegment,
    onPreviousSegment,
    onAutoSegment,
  } = config;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore shortcuts when typing in input/textarea
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // F2 - Play selected segment
      if (event.key === "F2" && onPlaySegment) {
        event.preventDefault();
        onPlaySegment();
        return;
      }

      // Space - Play/pause (only when not in input field)
      if (event.key === " " && !isInputField && onPlayPause) {
        event.preventDefault();
        onPlayPause();
        return;
      }

      // Ctrl+S - Save
      if (event.ctrlKey && event.key === "s" && onSave) {
        event.preventDefault();
        onSave();
        return;
      }

      // Ctrl+N - Add segment
      if (event.ctrlKey && event.key === "n" && onAddSegment) {
        event.preventDefault();
        onAddSegment();
        return;
      }

      // Ctrl+D - Delete segment (only when not in input field)
      if (event.ctrlKey && event.key === "d" && !isInputField && onDeleteSegment) {
        event.preventDefault();
        onDeleteSegment();
        return;
      }

      // Ctrl+T - Split segment
      if (event.ctrlKey && event.key === "t" && onSplitSegment) {
        event.preventDefault();
        onSplitSegment();
        return;
      }

      // Ctrl+M - Merge segments
      if (event.ctrlKey && event.key === "m" && onMergeSegments) {
        event.preventDefault();
        onMergeSegments();
        return;
      }

      // Ctrl+Shift+A - Auto-segment
      if (event.ctrlKey && event.shiftKey && event.key === "A" && onAutoSegment) {
        event.preventDefault();
        onAutoSegment();
        return;
      }

      // Tab - Next segment (only when not in input field)
      if (event.key === "Tab" && !isInputField && !event.shiftKey && onNextSegment) {
        event.preventDefault();
        onNextSegment();
        return;
      }

      // Shift+Tab - Previous segment (only when not in input field)
      if (event.key === "Tab" && !isInputField && event.shiftKey && onPreviousSegment) {
        event.preventDefault();
        onPreviousSegment();
        return;
      }
    };

    // Add event listener
    window.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    enabled,
    onPlayPause,
    onPlaySegment,
    onSave,
    onAddSegment,
    onDeleteSegment,
    onSplitSegment,
    onMergeSegments,
    onNextSegment,
    onPreviousSegment,
    onAutoSegment,
  ]);
};

export default useKeyboardShortcuts;
