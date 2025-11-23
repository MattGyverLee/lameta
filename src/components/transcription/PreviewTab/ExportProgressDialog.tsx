/**
 * ExportProgressDialog - Shows FFmpeg export progress
 * Displays real-time progress updates during video/audio export
 */

import React from "react";
import "./ExportProgressDialog.css";

/**
 * Export progress state
 */
export interface ExportProgress {
  stage: string;
  percent: number;
  message: string;
}

/**
 * Props for ExportProgressDialog
 */
export interface ExportProgressDialogProps {
  /** Whether dialog is open */
  isOpen: boolean;

  /** Current export progress */
  progress: ExportProgress;

  /** Error message if export failed */
  error?: string;

  /** Callback when dialog is closed (only available after completion or error) */
  onClose: () => void;
}

/**
 * ExportProgressDialog Component
 *
 * Displays export progress with stage indicator and progress bar.
 * Cannot be closed while export is in progress.
 */
export const ExportProgressDialog: React.FC<ExportProgressDialogProps> = ({
  isOpen,
  progress,
  error,
  onClose,
}) => {
  if (!isOpen) return null;

  const isComplete = progress.stage === "Complete";
  const hasError = !!error;
  const canClose = isComplete || hasError;

  return (
    <div className="export-progress-overlay">
      <div className="export-progress-dialog">
        {/* Header */}
        <div className="export-progress-header">
          <h3>
            {hasError ? "Export Failed" : isComplete ? "Export Complete" : "Exporting..."}
          </h3>
        </div>

        {/* Progress Content */}
        <div className="export-progress-content">
          {/* Error Message */}
          {hasError && (
            <div className="error-message">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Progress Bar */}
          {!hasError && (
            <>
              <div className="progress-stage">{progress.stage}</div>

              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>

              <div className="progress-percent">{Math.round(progress.percent)}%</div>

              <div className="progress-message">{progress.message}</div>
            </>
          )}

          {/* Success Message */}
          {isComplete && !hasError && (
            <div className="success-message">
              Your file has been exported successfully!
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="dialog-actions">
          {canClose && (
            <button onClick={onClose} className="btn-close-progress">
              Close
            </button>
          )}
          {!canClose && (
            <div className="exporting-notice">
              Please wait while your file is being exported...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportProgressDialog;
