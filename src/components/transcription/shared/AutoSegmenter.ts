/**
 * AutoSegmenter - Automatic audio segmentation using Web Audio API
 * Based on SayMore's AutoSegmenter algorithm
 */

import { AnnotationSegment, SegmentationSettings } from "./types";

/**
 * Analyze audio and automatically create segments based on silence detection
 * @param audioBuffer Web Audio API AudioBuffer
 * @param settings Segmentation settings
 * @returns Array of generated annotation segments
 */
export async function autoSegment(
  audioBuffer: AudioBuffer,
  settings: SegmentationSettings
): Promise<AnnotationSegment[]> {
  const {
    minimumSegmentLengthMs,
    maximumSegmentLengthMs,
    preferredPauseLengthMs,
    optimumLengthClampingFactor,
    silenceThresholdDb,
  } = settings;

  // Convert settings to seconds
  const minSegmentLength = minimumSegmentLengthMs / 1000;
  const maxSegmentLength = maximumSegmentLengthMs / 1000;
  const preferredPauseLength = preferredPauseLengthMs / 1000;

  // Get audio data (mono)
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;

  // Calculate RMS (Root Mean Square) for volume analysis
  const windowSize = Math.floor(sampleRate * 0.1); // 100ms windows
  const rmsValues: number[] = [];

  for (let i = 0; i < channelData.length; i += windowSize) {
    const window = channelData.slice(i, Math.min(i + windowSize, channelData.length));
    const rms = calculateRMS(window);
    rmsValues.push(rms);
  }

  // Convert silence threshold from dB to linear scale
  const silenceThreshold = dbToLinear(silenceThresholdDb);

  // Find silence regions
  const silenceRegions: Array<{ start: number; end: number }> = [];
  let silenceStart: number | null = null;

  rmsValues.forEach((rms, index) => {
    const time = (index * windowSize) / sampleRate;

    if (rms < silenceThreshold) {
      if (silenceStart === null) {
        silenceStart = time;
      }
    } else {
      if (silenceStart !== null) {
        const silenceEnd = time;
        const silenceDuration = silenceEnd - silenceStart;

        // Only record significant pauses
        if (silenceDuration >= preferredPauseLength * 0.3) {
          silenceRegions.push({
            start: silenceStart,
            end: silenceEnd,
          });
        }
        silenceStart = null;
      }
    }
  });

  // Create segments based on silence regions
  const segments: AnnotationSegment[] = [];
  let segmentStart = 0;
  let segmentId = 1;

  silenceRegions.forEach((silence) => {
    const potentialEnd = silence.start;
    const segmentLength = potentialEnd - segmentStart;

    // Check if segment meets minimum length
    if (segmentLength >= minSegmentLength) {
      // Check if segment exceeds maximum length
      if (segmentLength > maxSegmentLength) {
        // Split long segment at preferred points
        const numSplits = Math.ceil(segmentLength / maxSegmentLength);
        const splitLength = segmentLength / numSplits;

        for (let i = 0; i < numSplits; i++) {
          const splitStart = segmentStart + i * splitLength;
          const splitEnd = Math.min(segmentStart + (i + 1) * splitLength, potentialEnd);

          segments.push({
            id: `seg-${segmentId++}`,
            start: splitStart,
            end: splitEnd,
            text: "",
            translation: "",
          });
        }
      } else {
        // Normal segment
        segments.push({
          id: `seg-${segmentId++}`,
          start: segmentStart,
          end: potentialEnd,
          text: "",
          translation: "",
        });
      }

      segmentStart = silence.end;
    }
  });

  // Add final segment if needed
  if (segmentStart < duration - minSegmentLength) {
    segments.push({
      id: `seg-${segmentId++}`,
      start: segmentStart,
      end: duration,
      text: "",
      translation: "",
    });
  }

  console.log(`Auto-segmentation created ${segments.length} segments`);
  return segments;
}

/**
 * Calculate Root Mean Square (RMS) of audio samples
 */
function calculateRMS(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Convert dB to linear scale
 */
function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Load audio file and decode to AudioBuffer
 * @param audioUrl URL or path to audio file
 * @returns AudioBuffer for analysis
 */
export async function loadAudioForSegmentation(audioUrl: string): Promise<AudioBuffer> {
  // Create AudioContext
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

  // Fetch audio file
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();

  // Decode audio data
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  return audioBuffer;
}

/**
 * Perform auto-segmentation on a media file
 * @param mediaFilePath Path to media file
 * @param settings Segmentation settings
 * @returns Promise that resolves to array of segments
 */
export async function autoSegmentMediaFile(
  mediaFilePath: string,
  settings: SegmentationSettings
): Promise<AnnotationSegment[]> {
  try {
    console.log("Starting auto-segmentation...");

    // Load and decode audio
    const audioBuffer = await loadAudioForSegmentation(`file:///${mediaFilePath}`);

    // Perform segmentation
    const segments = await autoSegment(audioBuffer, settings);

    console.log(`Auto-segmentation complete: ${segments.length} segments created`);
    return segments;
  } catch (error) {
    console.error("Auto-segmentation failed:", error);
    throw error;
  }
}
