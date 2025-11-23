/**
 * AutoSegmenter - Automatic audio segmentation matching SayMore's algorithm
 * Direct port from SayMore/Transcription/Model/AutoSegmenter.cs
 */

import { AnnotationSegment, SegmentationSettings } from "./types";

/**
 * Analyze audio and automatically create segments based on SayMore's algorithm
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
  } = settings;

  // Get audio data (mono)
  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;
  const sampleRate = audioBuffer.sampleRate;
  const millisecondsPerSample = (audioBuffer.duration * 1000) / totalSamples;

  // Convert settings to samples
  const adjacentSamplesToFactor = Math.floor(preferredPauseLengthMs / millisecondsPerSample);
  const minSamplesPerSegment = Math.floor(minimumSegmentLengthMs / millisecondsPerSample);
  const maxSamplesPerSegment = Math.floor(maximumSegmentLengthMs / millisecondsPerSample);
  const idealSegmentLengthInSamples = Math.ceil((minSamplesPerSegment + maxSamplesPerSegment) / 2.0);

  const breakPoints: number[] = [];
  let remainingSamples = totalSamples;
  let lastBreak = 0;

  // Find natural breaks using SayMore's algorithm
  while (remainingSamples >= maxSamplesPerSegment) {
    let currentIdealLength = idealSegmentLengthInSamples;

    // Adjust ideal length if remaining audio is less than 2x ideal
    if (remainingSamples < idealSegmentLengthInSamples * 2) {
      currentIdealLength = Math.floor(remainingSamples / 2);
    }

    const samplesOnEitherSideOfTarget =
      currentIdealLength + adjacentSamplesToFactor - minSamplesPerSegment;
    const targetBreak = lastBreak + currentIdealLength;

    // Compute scores for potential break points
    const rawScores: number[] = new Array(currentIdealLength * 2 + 1);
    const adjustedScores: number[] = new Array(currentIdealLength * 2 + 1);

    // Score the target break
    rawScores[currentIdealLength] = computeRawScore(channelData, targetBreak);
    let bestBreak = targetBreak;
    let bestScore = Number.MAX_VALUE;

    // Score points on either side of target
    for (let i = 1; i < samplesOnEitherSideOfTarget; i++) {
      if (i < currentIdealLength) {
        rawScores[currentIdealLength + i] = computeRawScore(channelData, targetBreak + i);
        rawScores[currentIdealLength - i] = computeRawScore(channelData, targetBreak - i);
      }

      if (i >= adjacentSamplesToFactor) {
        // Compute adjusted scores using adjacent samples
        const scoreAbove = computeAdjustedScore(
          rawScores,
          currentIdealLength + i,
          adjacentSamplesToFactor,
          optimumLengthClampingFactor,
          i
        );
        const scoreBelow = computeAdjustedScore(
          rawScores,
          currentIdealLength - i,
          adjacentSamplesToFactor,
          optimumLengthClampingFactor,
          i
        );

        if (scoreAbove < bestScore) {
          bestScore = scoreAbove;
          bestBreak = targetBreak + i;
        }
        if (scoreBelow < bestScore) {
          bestScore = scoreBelow;
          bestBreak = targetBreak - i;
        }
      }
    }

    breakPoints.push(bestBreak);
    remainingSamples -= bestBreak - lastBreak;
    lastBreak = bestBreak;
  }

  // Convert break points to segments
  const segments: AnnotationSegment[] = [];
  let previousBreak = 0;

  breakPoints.forEach((breakPoint, index) => {
    const startTime = (previousBreak / sampleRate);
    const endTime = (breakPoint / sampleRate);

    segments.push({
      id: `seg-${index + 1}`,
      start: startTime,
      end: endTime,
      text: "",
      translation: "",
    });

    previousBreak = breakPoint;
  });

  // Add final segment if there's remaining audio
  if (previousBreak < totalSamples) {
    segments.push({
      id: `seg-${segments.length + 1}`,
      start: previousBreak / sampleRate,
      end: audioBuffer.duration,
      text: "",
      translation: "",
    });
  }

  console.log(`Auto-segmentation created ${segments.length} segments`);
  return segments;
}

/**
 * Compute raw score (RMS) at a given sample position
 * Matching SayMore's ComputeRawScore method
 */
function computeRawScore(samples: Float32Array, position: number): number {
  const windowSize = 100; // Small window around the position
  const start = Math.max(0, position - Math.floor(windowSize / 2));
  const end = Math.min(samples.length, position + Math.floor(windowSize / 2));

  let sum = 0;
  let count = 0;

  for (let i = start; i < end; i++) {
    sum += samples[i] * samples[i];
    count++;
  }

  return count > 0 ? Math.sqrt(sum / count) : 0;
}

/**
 * Compute adjusted score considering adjacent samples and distance from ideal
 * Matching SayMore's adjusted score calculation
 */
function computeAdjustedScore(
  rawScores: number[],
  index: number,
  adjacentSamples: number,
  clampingFactor: number,
  distanceFromIdeal: number
): number {
  // Average raw scores of adjacent samples
  let sum = 0;
  let count = 0;

  const start = Math.max(0, index - adjacentSamples);
  const end = Math.min(rawScores.length, index + adjacentSamples + 1);

  for (let i = start; i < end; i++) {
    if (rawScores[i] !== undefined) {
      sum += rawScores[i];
      count++;
    }
  }

  const averageRawScore = count > 0 ? sum / count : rawScores[index] || 0;

  // Apply clamping factor to favor breaks near ideal length
  // The further from ideal, the higher the penalty
  const distancePenalty = Math.pow(distanceFromIdeal, clampingFactor);

  return averageRawScore * (1 + distancePenalty * 0.01);
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
    console.log("Starting auto-segmentation (SayMore algorithm)...");

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
