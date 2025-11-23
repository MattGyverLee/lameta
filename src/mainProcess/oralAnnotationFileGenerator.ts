/**
 * OralAnnotationFileGenerator - Generate interleaved multi-channel .wav files
 * Direct port from SayMore/Transcription/Model/OralAnnotationFileGenerator.cs
 *
 * Creates a single audio file with interleaved channels:
 * - 1-2 channels for source recording (mono/stereo)
 * - 1 channel for careful speech annotations
 * - 1 channel for oral translation annotations
 *
 * Output: {mediaFile}.oralAnnotations.wav (3-4 channels total)
 */

import * as fs from "fs";
import * as path from "path";
import { AnnotationSegment } from "../components/transcription/shared/types";

/**
 * Progress callback for generation updates
 */
export interface GenerationProgress {
  stage: string;
  current: number;
  total: number;
  percentage: number;
}

/**
 * WAV file header structure
 */
interface WavHeader {
  sampleRate: number;
  bitsPerSample: number;
  numChannels: number;
}

/**
 * Generate interleaved oral annotation file
 * Matches SayMore's OralAnnotationFileGenerator.cs logic
 *
 * @param mediaFilePath Path to source media file
 * @param segments Array of annotation segments
 * @param annotationsDir Path to _Annotations folder
 * @param onProgress Optional progress callback
 * @returns Promise that resolves to output file path
 */
export async function generateOralAnnotationFile(
  mediaFilePath: string,
  segments: AnnotationSegment[],
  annotationsDir: string,
  onProgress?: (progress: GenerationProgress) => void
): Promise<string> {
  console.log("Starting oral annotation file generation...");

  // Output file: {mediaFile}.oralAnnotations.wav
  const outputFileName = `${mediaFilePath}.oralAnnotations.wav`;

  try {
    // Read source audio format
    const sourceHeader = readWavHeader(mediaFilePath);
    console.log(`Source format: ${sourceHeader.numChannels}ch, ${sourceHeader.sampleRate}Hz, ${sourceHeader.bitsPerSample}-bit`);

    // Output format: source channels + 2 (careful + translation)
    const outputChannels = sourceHeader.numChannels + 2;
    const outputHeader: WavHeader = {
      sampleRate: sourceHeader.sampleRate,
      bitsPerSample: sourceHeader.bitsPerSample,
      numChannels: outputChannels,
    };

    // Create temporary output file
    const tmpOutputFile = path.join(
      path.dirname(outputFileName),
      `.tmp_${path.basename(outputFileName)}`
    );

    // Open output file writer
    const outputStream = fs.createWriteStream(tmpOutputFile);

    // Write WAV header (we'll update data size at the end)
    writeWavHeader(outputStream, outputHeader, 0);

    let totalSamplesWritten = 0;
    let currentSegment = 0;

    // Process each segment
    for (const segment of segments) {
      currentSegment++;

      if (onProgress) {
        onProgress({
          stage: `Processing segment ${currentSegment} of ${segments.length}`,
          current: currentSegment,
          total: segments.length,
          percentage: Math.round((currentSegment / segments.length) * 100),
        });
      }

      console.log(`Interleaving segment ${currentSegment}/${segments.length}: ${segment.start}s - ${segment.end}s`);

      // Interleave this segment's audio
      const samplesWritten = await interleaveSegment(
        mediaFilePath,
        segment,
        annotationsDir,
        sourceHeader,
        outputHeader,
        outputStream
      );

      totalSamplesWritten += samplesWritten;
    }

    // Close output stream
    outputStream.end();

    // Wait for stream to finish
    await new Promise<void>((resolve) => outputStream.on("finish", resolve));

    // Update WAV header with correct data size
    updateWavDataSize(tmpOutputFile, totalSamplesWritten, outputHeader);

    // Move temp file to final location
    if (fs.existsSync(outputFileName)) {
      fs.unlinkSync(outputFileName);
    }
    fs.renameSync(tmpOutputFile, outputFileName);

    console.log(`Oral annotation file generated: ${outputFileName}`);
    console.log(`Total samples: ${totalSamplesWritten}, Duration: ${totalSamplesWritten / outputHeader.sampleRate}s`);

    return outputFileName;
  } catch (error) {
    console.error("Failed to generate oral annotation file:", error);
    throw error;
  }
}

/**
 * Interleave audio for a single segment
 * Matches SayMore's InterleaveSegments method (lines 260-285)
 */
async function interleaveSegment(
  mediaFilePath: string,
  segment: AnnotationSegment,
  annotationsDir: string,
  sourceHeader: WavHeader,
  outputHeader: WavHeader,
  outputStream: fs.WriteStream
): Promise<number> {
  // Extract source audio for this segment time range
  const sourceAudio = extractSegmentAudio(
    mediaFilePath,
    segment.start,
    segment.end,
    sourceHeader
  );

  // Load careful speech file (if exists)
  const carefulFileName = `${segment.start}_to_${segment.end}_Careful.wav`;
  const carefulPath = path.join(annotationsDir, carefulFileName);
  const carefulAudio = fs.existsSync(carefulPath)
    ? readWavAudioData(carefulPath)
    : null;

  // Load oral translation file (if exists)
  const translationFileName = `${segment.start}_to_${segment.end}_Translation.wav`;
  const translationPath = path.join(annotationsDir, translationFileName);
  const translationAudio = fs.existsSync(translationPath)
    ? readWavAudioData(translationPath)
    : null;

  // Determine longest audio to know how many samples to write
  const sourceLength = sourceAudio.samples.length / sourceHeader.numChannels;
  const carefulLength = carefulAudio ? carefulAudio.samples.length : 0;
  const translationLength = translationAudio ? translationAudio.samples.length : 0;
  const maxLength = Math.max(sourceLength, carefulLength, translationLength);

  // Interleave samples
  // SayMore's WriteAudioStreamToChannel logic (lines 310-343):
  // - Source: write source samples, then 0 for careful and translation
  // - Careful: write 0 for source, then careful sample, then 0 for translation
  // - Translation: write 0 for source and careful, then translation sample

  let samplesWritten = 0;
  const buffer = Buffer.alloc(outputHeader.numChannels * (outputHeader.bitsPerSample / 8));

  for (let i = 0; i < maxLength; i++) {
    const bufferOffset = 0;
    let offset = bufferOffset;

    // Write source channel(s)
    for (let ch = 0; ch < sourceHeader.numChannels; ch++) {
      const sourceIndex = i * sourceHeader.numChannels + ch;
      const sample = sourceIndex < sourceAudio.samples.length
        ? sourceAudio.samples[sourceIndex]
        : 0;
      offset = writeSample(buffer, offset, sample, outputHeader.bitsPerSample);
    }

    // Write careful speech channel
    const carefulSample = carefulAudio && i < carefulLength
      ? carefulAudio.samples[i]
      : 0;
    offset = writeSample(buffer, offset, carefulSample, outputHeader.bitsPerSample);

    // Write translation channel
    const translationSample = translationAudio && i < translationLength
      ? translationAudio.samples[i]
      : 0;
    writeSample(buffer, offset, translationSample, outputHeader.bitsPerSample);

    // Write interleaved sample block
    outputStream.write(buffer);
    samplesWritten++;
  }

  return samplesWritten;
}

/**
 * Read WAV file header
 */
function readWavHeader(filePath: string): WavHeader {
  const buffer = Buffer.alloc(44); // Standard WAV header is 44 bytes
  const fd = fs.openSync(filePath, "r");
  fs.readSync(fd, buffer, 0, 44, 0);
  fs.closeSync(fd);

  // Verify RIFF header
  if (buffer.toString("ascii", 0, 4) !== "RIFF") {
    throw new Error("Not a valid WAV file (missing RIFF header)");
  }

  // Verify WAVE format
  if (buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Not a valid WAV file (missing WAVE format)");
  }

  // Read format chunk
  const numChannels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);

  return { sampleRate, bitsPerSample, numChannels };
}

/**
 * Write WAV file header
 */
function writeWavHeader(
  stream: fs.WriteStream,
  header: WavHeader,
  dataSize: number
): void {
  const buffer = Buffer.alloc(44);

  // RIFF header
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4); // File size - 8
  buffer.write("WAVE", 8, "ascii");

  // fmt chunk
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // Audio format (1 = PCM)
  buffer.writeUInt16LE(header.numChannels, 22);
  buffer.writeUInt32LE(header.sampleRate, 24);
  const blockAlign = header.numChannels * (header.bitsPerSample / 8);
  const byteRate = header.sampleRate * blockAlign;
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(header.bitsPerSample, 34);

  // data chunk header
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  stream.write(buffer);
}

/**
 * Update WAV file data size after writing is complete
 */
function updateWavDataSize(
  filePath: string,
  totalSamples: number,
  header: WavHeader
): void {
  const blockAlign = header.numChannels * (header.bitsPerSample / 8);
  const dataSize = totalSamples * blockAlign;

  const fd = fs.openSync(filePath, "r+");

  // Update file size (offset 4)
  const fileSizeBuffer = Buffer.alloc(4);
  fileSizeBuffer.writeUInt32LE(36 + dataSize, 0);
  fs.writeSync(fd, fileSizeBuffer, 0, 4, 4);

  // Update data chunk size (offset 40)
  const dataSizeBuffer = Buffer.alloc(4);
  dataSizeBuffer.writeUInt32LE(dataSize, 0);
  fs.writeSync(fd, dataSizeBuffer, 0, 4, 40);

  fs.closeSync(fd);
}

/**
 * Extract audio segment from source file
 */
function extractSegmentAudio(
  filePath: string,
  startTime: number,
  endTime: number,
  header: WavHeader
): { samples: number[] } {
  const fd = fs.openSync(filePath, "r");

  // Find data chunk
  const headerBuffer = Buffer.alloc(44);
  fs.readSync(fd, headerBuffer, 0, 44, 0);

  // Calculate byte positions
  const blockAlign = header.numChannels * (header.bitsPerSample / 8);
  const startSample = Math.floor(startTime * header.sampleRate);
  const endSample = Math.ceil(endTime * header.sampleRate);
  const numSamples = endSample - startSample;

  const startByte = 44 + startSample * blockAlign;
  const numBytes = numSamples * blockAlign;

  // Read audio data
  const audioBuffer = Buffer.alloc(numBytes);
  fs.readSync(fd, audioBuffer, 0, numBytes, startByte);
  fs.closeSync(fd);

  // Convert to samples
  const samples: number[] = [];
  for (let i = 0; i < numBytes; i += header.bitsPerSample / 8) {
    const sample = readSampleFromBuffer(audioBuffer, i, header.bitsPerSample);
    samples.push(sample);
  }

  return { samples };
}

/**
 * Read entire WAV file audio data
 */
function readWavAudioData(filePath: string): { samples: number[] } {
  const header = readWavHeader(filePath);
  const fd = fs.openSync(filePath, "r");

  // Read entire file
  const stats = fs.fstatSync(fd);
  const fileSize = stats.size;
  const audioDataSize = fileSize - 44;

  const audioBuffer = Buffer.alloc(audioDataSize);
  fs.readSync(fd, audioBuffer, 0, audioDataSize, 44);
  fs.closeSync(fd);

  // Convert to samples
  const samples: number[] = [];
  for (let i = 0; i < audioDataSize; i += header.bitsPerSample / 8) {
    const sample = readSampleFromBuffer(audioBuffer, i, header.bitsPerSample);
    samples.push(sample);
  }

  return { samples };
}

/**
 * Read a single sample from buffer
 */
function readSampleFromBuffer(
  buffer: Buffer,
  offset: number,
  bitsPerSample: number
): number {
  if (bitsPerSample === 16) {
    return buffer.readInt16LE(offset);
  } else if (bitsPerSample === 8) {
    return buffer.readInt8(offset);
  } else if (bitsPerSample === 24) {
    // 24-bit audio (read 3 bytes as signed)
    const byte1 = buffer.readUInt8(offset);
    const byte2 = buffer.readUInt8(offset + 1);
    const byte3 = buffer.readInt8(offset + 2); // Sign from highest byte
    return byte1 | (byte2 << 8) | (byte3 << 16);
  } else if (bitsPerSample === 32) {
    return buffer.readInt32LE(offset);
  }
  return 0;
}

/**
 * Write a single sample to buffer
 * Returns new offset after writing
 */
function writeSample(
  buffer: Buffer,
  offset: number,
  sample: number,
  bitsPerSample: number
): number {
  if (bitsPerSample === 16) {
    buffer.writeInt16LE(sample, offset);
    return offset + 2;
  } else if (bitsPerSample === 8) {
    buffer.writeInt8(sample, offset);
    return offset + 1;
  } else if (bitsPerSample === 24) {
    // 24-bit audio (write 3 bytes)
    buffer.writeUInt8(sample & 0xff, offset);
    buffer.writeUInt8((sample >> 8) & 0xff, offset + 1);
    buffer.writeInt8((sample >> 16) & 0xff, offset + 2);
    return offset + 3;
  } else if (bitsPerSample === 32) {
    buffer.writeInt32LE(sample, offset);
    return offset + 4;
  }
  return offset;
}
