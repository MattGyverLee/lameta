/**
 * FFmpeg Service - Video/Audio export matching Prestige's ExportVid logic
 *
 * Adapted from Prestige for Lameta's segment-based structure:
 * - Uses individual segment .wav files instead of merged audio files
 * - Implements kings/princes audio mixing strategy
 * - Builds clips per segment (like Prestige does per milestone)
 * - Supports "all kings" toggle mode
 */

import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs-extra";
import { app } from "electron";

/**
 * Export format options
 */
export enum ExportFormat {
  Video = "video",
  AudioOnly = "audio",
}

/**
 * Export settings
 */
export interface ExportSettings {
  format: ExportFormat;
  includeSubtitles: boolean;
  subtitleLanguage: "transcription" | "translation" | "both";
  outputPath: string;
  videoQuality: number; // CRF 0-51
  audioBitrate: number; // kbps
}

/**
 * Annotation segment (Lameta's equivalent of Prestige's Milestone)
 */
export interface AnnotationSegment {
  id: string;
  start: number; // Start time in source video
  end: number;   // End time in source video
  transcription?: string;
  translation?: string;
  carefulSpeechFile?: string;    // Individual segment .wav file
  oralTranslationFile?: string;  // Individual segment .wav file
}

/**
 * Audio track configuration
 */
export interface AudioTrack {
  id: string;
  label: string;
  url: string;
  volume: number; // 0-100
  muted: boolean;
  isKing: boolean; // Whether this track is a king (volume >= 84%)
}

/**
 * Kings/Princes mode configuration
 */
export interface KingsPrincesMode {
  useKingsPrincesLogic: boolean; // If false, all active tracks are kings
  kingThreshold: number; // Default: 84
}

/**
 * Video clip configuration (matching Prestige's VideoClip structure)
 */
interface VideoClip {
  // Video source
  V1: string;
  V1Start: number;
  V1Stop: number;
  V1Speed: number;

  // Primary audio (A1 - the "king")
  A1: string;
  A1Start: number;
  A1Stop: number;
  A1Speed: number;
  A1Vol: number;

  // Secondary audio (A2 - the "prince", if present)
  isA2: boolean;
  A2?: string;
  A2Start?: number;
  A2Stop?: number;
  A2Speed?: number;
  A2Vol?: number;

  // Subtitle
  subtitle: string;
  Comment: string;
}

/**
 * Progress callback type
 */
export type ProgressCallback = (progress: {
  stage: string;
  percent: number;
  message: string;
}) => void;

/**
 * Volume threshold for "king" classification (matching Prestige)
 * 0.5 ** 0.25 ≈ 0.84 (84%)
 */
const KING_VOLUME_THRESHOLD = 84;

/**
 * FFmpeg Service Class
 */
export class FFmpegService {
  /**
   * Export video/audio with Prestige's kings/princes logic
   */
  public async exportMedia(
    mediaFilePath: string,
    segments: AnnotationSegment[],
    tracks: AudioTrack[],
    kingsPrincesMode: KingsPrincesMode,
    settings: ExportSettings,
    onProgress: ProgressCallback
  ): Promise<void> {
    try {
      onProgress({
        stage: "Preparing",
        percent: 0,
        message: "Initializing export...",
      });

      // Create temp directory for intermediate files
      const tempDir = path.join(app.getPath("temp"), `lameta-export-${Date.now()}`);
      await fs.ensureDir(tempDir);

      try {
        // Step 1: Categorize audio tracks into kings and princes
        const { kings, princes } = this.categorizeAudioByVolume(tracks, kingsPrincesMode);

        if (kings.length === 0) {
          throw new Error("Enable at least one audio track before exporting.");
        }

        console.log("=== LAMETA EXPORT DEBUG ===");
        console.log("Kings (primary audio):", kings);
        console.log("Princes (background audio):", princes);
        console.log("Segments:", segments.length);

        // Get multiplier from settings (default to 1.0)
        const multiplier = settings.multiplier || 1.0;

        // Step 2: Build video clips for each segment (like Prestige does per milestone)
        onProgress({
          stage: "Building Clips",
          percent: 10,
          message: `Building ${segments.length} segment clips...`,
        });

        const clips = this.buildSegmentClips({
          segments,
          mediaFilePath,
          kings,
          princes,
          tracks,
          kingsPrincesMode,
          multiplier,
        });

        console.log(`Built ${clips.length} clips for export`);

        // Validate all clips before processing
        const allErrors: string[] = [];
        clips.forEach((clip, index) => {
          const validation = this.validateClip(clip);
          if (!validation.valid) {
            allErrors.push(`Clip ${index}: ${validation.errors.join(', ')}`);
          }
        });

        if (allErrors.length > 0) {
          throw new Error(`Clip validation failed:\n${allErrors.join('\n')}`);
        }

        // Step 3: Process each clip with FFmpeg
        const clipFiles: string[] = [];

        for (let i = 0; i < clips.length; i++) {
          const clip = clips[i];
          const progress = 10 + (70 * (i + 1)) / clips.length;

          onProgress({
            stage: "Processing Clips",
            percent: progress,
            message: `Processing clip ${i + 1}/${clips.length}...`,
          });

          const clipFile = await this.processClip(clip, i, tempDir);
          clipFiles.push(clipFile);
        }

        // Step 4: Concatenate clips
        onProgress({
          stage: "Concatenating",
          percent: 80,
          message: "Combining clips...",
        });

        const concatenatedFile = await this.concatenateClips(
          clipFiles,
          settings.format,
          tempDir
        );

        // Step 5: Add subtitles and finalize
        onProgress({
          stage: "Finalizing",
          percent: 90,
          message: "Creating final output...",
        });

        await this.finalizeExport(
          concatenatedFile,
          clips,
          settings,
          tempDir,
          onProgress
        );

        onProgress({
          stage: "Complete",
          percent: 100,
          message: "Export completed successfully!",
        });
      } finally {
        // Cleanup temp directory
        await fs.remove(tempDir);
      }
    } catch (error) {
      throw new Error(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Categorize tracks into kings and princes (matching Prestige logic)
   */
  private categorizeAudioByVolume(
    tracks: AudioTrack[],
    kingsPrincesMode: KingsPrincesMode
  ): { kings: number[]; princes: number[] } {
    const kings: number[] = [];
    const princes: number[] = [];

    tracks.forEach((track, index) => {
      if (track.muted || track.volume === 0) {
        return; // Silent tracks excluded
      }

      // All kings mode: all active tracks are kings
      if (!kingsPrincesMode.useKingsPrincesLogic) {
        kings.push(index);
        return;
      }

      // Kings/princes mode: check volume threshold
      if (track.volume >= KING_VOLUME_THRESHOLD) {
        kings.push(index);
      } else {
        princes.push(index);
      }
    });

    return { kings, princes };
  }

  /**
   * Build clips for all segments (matching Prestige's buildMilestoneClips)
   */
  private buildSegmentClips(params: {
    segments: AnnotationSegment[];
    mediaFilePath: string;
    kings: number[];
    princes: number[];
    tracks: AudioTrack[];
    kingsPrincesMode: KingsPrincesMode;
    multiplier: number;
  }): VideoClip[] {
    const { segments, mediaFilePath, kings, princes, tracks, multiplier } = params;
    const clips: VideoClip[] = [];

    segments.forEach((segment, segmentIndex) => {
      // Video timing (same for all clips in this segment)
      const V1 = mediaFilePath;
      const V1Start = segment.start;
      const V1Stop = segment.end;

      // Process each king track
      kings.forEach((kingIndex) => {
        const kingConfig = this.calculateKingAudio({
          kingIndex,
          segment,
          mediaFilePath,
          multiplier,
        });

        if (!kingConfig) {
          console.warn(`Skipping segment ${segmentIndex}, king ${kingIndex}: no audio found`);
          return;
        }

        const { A1, A1Start, A1Stop, A1Speed, V1Speed, kingLen } = kingConfig;
        const subtitle = this.getSubtitleForKing(segment, kingIndex);

        // Add clips with prince voiceovers if present
        if (princes.length > 0) {
          const princeClips = this.buildPrinceClips({
            princes,
            segment,
            segmentIndex,
            V1,
            V1Start,
            V1Stop,
            V1Speed,
            A1,
            A1Start,
            A1Stop,
            A1Speed,
            kingLen,
            kingIndex,
            tracks,
            subtitle,
          });
          clips.push(...princeClips);
        } else {
          // No princes: clip with only king audio
          clips.push({
            V1,
            V1Start,
            V1Stop,
            V1Speed,
            A1,
            A1Start,
            A1Stop,
            A1Speed,
            A1Vol: tracks[kingIndex].volume / 100,
            isA2: false,
            subtitle,
            Comment: `Segment ${segmentIndex}: King ${kingIndex}`,
          });
        }
      });
    });

    return clips;
  }

  /**
   * Calculate king audio configuration (matching Prestige's calculateKingAudio)
   */
  private calculateKingAudio(params: {
    kingIndex: number;
    segment: AnnotationSegment;
    mediaFilePath: string;
    multiplier: number;
  }): {
    A1: string;
    A1Start: number;
    A1Stop: number;
    A1Speed: number;
    V1Speed: number;
    kingLen: number;
  } | null {
    const { kingIndex, segment, mediaFilePath, multiplier } = params;

    // King Index 0: Video's original audio
    if (kingIndex === 0) {
      const A1Speed = multiplier;
      const kingLen = (segment.end - segment.start) / A1Speed;
      return {
        A1: mediaFilePath,
        A1Start: segment.start,
        A1Stop: segment.end,
        A1Speed,
        V1Speed: multiplier,
        kingLen,
      };
    }

    // King Index 1: Careful speech .wav file (SayMore naming: {start}_to_{end}_Careful.wav)
    if (kingIndex === 1 && segment.carefulSpeechFile) {
      const A1 = segment.carefulSpeechFile;
      const A1Speed = multiplier;
      // Oral annotation files start from 0 (relative to segment)
      const A1Start = 0;
      const A1Stop = segment.end - segment.start; // Duration matches segment
      const kingLen = (A1Stop - A1Start) / A1Speed;
      const V1Speed = (segment.end - segment.start) / kingLen;

      return { A1, A1Start, A1Stop, A1Speed, V1Speed, kingLen };
    }

    // King Index 2: Oral translation .wav file (SayMore naming: {start}_to_{end}_Translation.wav)
    if (kingIndex === 2 && segment.oralTranslationFile) {
      const A1 = segment.oralTranslationFile;
      const A1Speed = multiplier;
      const A1Start = 0;
      const A1Stop = segment.end - segment.start;
      const kingLen = (A1Stop - A1Start) / A1Speed;
      const V1Speed = (segment.end - segment.start) / kingLen;

      return { A1, A1Start, A1Stop, A1Speed, V1Speed, kingLen };
    }

    return null; // King audio not found
  }

  /**
   * Build clips with prince audio (matching Prestige's buildPrinceClips)
   */
  private buildPrinceClips(params: {
    princes: number[];
    segment: AnnotationSegment;
    segmentIndex: number;
    V1: string;
    V1Start: number;
    V1Stop: number;
    V1Speed: number;
    A1: string;
    A1Start: number;
    A1Stop: number;
    A1Speed: number;
    kingLen: number;
    kingIndex: number;
    tracks: AudioTrack[];
    subtitle: string;
  }): VideoClip[] {
    const {
      princes,
      segment,
      segmentIndex,
      V1,
      V1Start,
      V1Stop,
      V1Speed,
      A1,
      A1Start,
      A1Stop,
      A1Speed,
      kingLen,
      kingIndex,
      tracks,
      subtitle,
    } = params;

    const clips: VideoClip[] = [];
    let clipCreated = false;

    princes.forEach((princeIndex) => {
      // Prince Index 0: Video audio as background
      if (princeIndex === 0) {
        clips.push({
          V1,
          V1Start,
          V1Stop,
          V1Speed,
          A1,
          A1Start,
          A1Stop,
          A1Speed,
          A1Vol: tracks[kingIndex].volume / 100,
          isA2: true,
          A2: V1, // Video audio as prince
          A2Start: V1Start,
          A2Stop: V1Stop,
          A2Speed: V1Speed,
          A2Vol: tracks[princeIndex].volume / 100,
          subtitle,
          Comment: `Segment ${segmentIndex}: King ${kingIndex} with voiceover ${princeIndex}`,
        });
        clipCreated = true;
      }
      // Prince Index 1: Careful speech as background
      else if (princeIndex === 1 && segment.carefulSpeechFile) {
        const A2 = segment.carefulSpeechFile;
        const A2Start = 0;
        const A2Stop = segment.end - segment.start;
        const A2Speed = (A2Stop - A2Start) / kingLen; // Adjust to match king duration

        clips.push({
          V1,
          V1Start,
          V1Stop,
          V1Speed,
          A1,
          A1Start,
          A1Stop,
          A1Speed,
          A1Vol: tracks[kingIndex].volume / 100,
          isA2: true,
          A2,
          A2Start,
          A2Stop,
          A2Speed,
          A2Vol: tracks[princeIndex].volume / 100,
          subtitle,
          Comment: `Segment ${segmentIndex}: King ${kingIndex} with voiceover ${princeIndex}`,
        });
        clipCreated = true;
      }
      // Prince Index 2: Oral translation as background
      else if (princeIndex === 2 && segment.oralTranslationFile) {
        const A2 = segment.oralTranslationFile;
        const A2Start = 0;
        const A2Stop = segment.end - segment.start;
        const A2Speed = (A2Stop - A2Start) / kingLen; // Adjust to match king duration

        clips.push({
          V1,
          V1Start,
          V1Stop,
          V1Speed,
          A1,
          A1Start,
          A1Stop,
          A1Speed,
          A1Vol: tracks[kingIndex].volume / 100,
          isA2: true,
          A2,
          A2Start,
          A2Stop,
          A2Speed,
          A2Vol: tracks[princeIndex].volume / 100,
          subtitle,
          Comment: `Segment ${segmentIndex}: King ${kingIndex} with voiceover ${princeIndex}`,
        });
        clipCreated = true;
      }
    });

    // Fallback: if no prince audio available, create clip with only king
    if (!clipCreated) {
      clips.push({
        V1,
        V1Start,
        V1Stop,
        V1Speed,
        A1,
        A1Start,
        A1Stop,
        A1Speed,
        A1Vol: tracks[kingIndex].volume / 100,
        isA2: false,
        subtitle,
        Comment: `Segment ${segmentIndex}: King ${kingIndex} (no voiceover)`,
      });
    }

    return clips;
  }

  /**
   * Get subtitle text for king track
   */
  private getSubtitleForKing(segment: AnnotationSegment, kingIndex: number): string {
    if (kingIndex <= 1) {
      // Kings 0-1: Show transcription
      return segment.transcription || "";
    } else if (kingIndex === 2) {
      // King 2: Show translation
      return segment.translation || "";
    }
    return "";
  }

  /**
   * Process a single clip with FFmpeg
   */
  private async processClip(
    clip: VideoClip,
    clipIndex: number,
    tempDir: string
  ): Promise<string> {
    const outputPath = path.join(tempDir, `clip_${clipIndex}.mp4`);

    // Build FFmpeg command
    const args: string[] = [
      // Video input
      "-ss", clip.V1Start.toString(),
      "-t", (clip.V1Stop - clip.V1Start).toString(),
      "-i", clip.V1,
    ];

    // Primary audio input (if different from video)
    if (clip.A1 !== clip.V1) {
      args.push(
        "-ss", clip.A1Start.toString(),
        "-t", (clip.A1Stop - clip.A1Start).toString(),
        "-i", clip.A1
      );
    }

    // Secondary audio input (prince)
    if (clip.isA2 && clip.A2) {
      args.push(
        "-ss", (clip.A2Start || 0).toString(),
        "-t", ((clip.A2Stop || 0) - (clip.A2Start || 0)).toString(),
        "-i", clip.A2
      );
    }

    // Build filter complex for speed adjustments and mixing
    const filterComplex = this.buildClipFilter(clip);

    args.push(
      "-filter_complex", filterComplex,
      "-map", "[v]",
      "-map", "[amix]",
      "-c:v", "libx264",
      "-crf", "18",
      "-preset", "medium",
      "-c:a", "aac",
      "-b:a", "192k",
      "-y",
      outputPath
    );

    // Debug logging: Write FFmpeg command to file for troubleshooting
    const debugPath = path.join(tempDir, `ffmpeg_cmd_${clipIndex}.txt`);
    const fullCommand = `ffmpeg ${args.join(' ')}`;
    fs.writeFileSync(debugPath, fullCommand, 'utf8');
    console.log(`Debug: FFmpeg command written to ${debugPath}`);

    await this.runFFmpeg(args);
    return outputPath;
  }

  /**
   * Build atempo filters for speed changes outside FFmpeg's 0.5-2.0 range
   * Chains multiple atempo filters to achieve extreme speeds
   * Matches Prestige's buildTempoFilters() algorithm
   */
  private buildTempoFilters(speed: number): string {
    const ATEMPO_MIN = 0.5;
    const ATEMPO_MAX = 2.0;
    const filters: string[] = [];
    let remainingSpeed = speed;

    // Handle speeds faster than 2x by chaining 2.0x filters
    while (remainingSpeed > ATEMPO_MAX) {
      filters.push('atempo=2.0');
      remainingSpeed = remainingSpeed / 2.0;
    }

    // Handle speeds slower than 0.5x by chaining 0.5x filters
    while (remainingSpeed < ATEMPO_MIN && remainingSpeed > 0) {
      filters.push('atempo=0.5');
      remainingSpeed = remainingSpeed / 0.5;
    }

    // Add final tempo filter if remaining speed is within valid range
    if (remainingSpeed >= ATEMPO_MIN && remainingSpeed <= ATEMPO_MAX) {
      filters.push(`atempo=${remainingSpeed.toFixed(4)}`);
    }

    return filters.join(',');
  }

  /**
   * Validate a video clip configuration
   * Returns validation result with errors if any
   */
  private validateClip(clip: VideoClip): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate required fields
    if (!clip.V1) {
      errors.push('Missing V1 (video source)');
    }
    if (!clip.A1) {
      errors.push('Missing A1 (audio source)');
    }
    if (clip.V1Start === undefined) {
      errors.push('Missing V1Start');
    }
    if (clip.V1Stop === undefined) {
      errors.push('Missing V1Stop');
    }
    if (clip.V1Speed === undefined) {
      errors.push('Missing V1Speed');
    }

    // Validate time ranges (stop must be after start)
    if (clip.V1Start !== undefined && clip.V1Stop !== undefined) {
      if (clip.V1Stop <= clip.V1Start) {
        errors.push('V1Stop must be greater than V1Start');
      }
    }
    if (clip.A1Start !== undefined && clip.A1Stop !== undefined) {
      if (clip.A1Stop <= clip.A1Start) {
        errors.push('A1Stop must be greater than A1Start');
      }
    }

    // Validate speed values (must be positive)
    if (clip.V1Speed !== undefined && clip.V1Speed <= 0) {
      errors.push('V1Speed must be greater than 0');
    }
    if (clip.A1Speed !== undefined && clip.A1Speed <= 0) {
      errors.push('A1Speed must be greater than 0');
    }

    // Validate secondary audio (A2) if enabled
    if (clip.isA2) {
      if (!clip.A2) {
        errors.push('isA2 is true but A2 is missing');
      }
      if (clip.A2Start === undefined) {
        errors.push('isA2 is true but A2Start is missing');
      }
      if (clip.A2Stop === undefined) {
        errors.push('isA2 is true but A2Stop is missing');
      }
      if (clip.A2Start !== undefined && clip.A2Stop !== undefined) {
        if (clip.A2Stop <= clip.A2Start) {
          errors.push('A2Stop must be greater than A2Start');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build FFmpeg filter for a clip
   */
  private buildClipFilter(clip: VideoClip): string {
    const filters: string[] = [];
    const audioInputs: string[] = [];

    // Video speed adjustment
    // setpts adjusts timestamps: to speed up by 2x, multiply PTS by 0.5
    // Formula: setpts = (1 / speed) * PTS
    if (clip.V1Speed !== 1.0) {
      const ptsMultiplier = 1 / clip.V1Speed;
      filters.push(`[0:v]setpts=${ptsMultiplier}*PTS[v]`);
    } else {
      filters.push(`[0:v]null[v]`); // Use null filter for passthrough
    }

    // Primary audio (A1 - king)
    const a1Input = clip.A1 === clip.V1 ? "0:a" : "1:a";
    const a1Filters: string[] = [];

    // Reset audio timestamps to prevent sync drift
    a1Filters.push('asetpts=PTS-STARTPTS');

    // Handle async audio/video sync issues
    a1Filters.push('aresample=async=1');

    if (clip.A1Speed !== 1.0) {
      // Use chained atempo filters for extreme speeds
      const tempoFilters = this.buildTempoFilters(clip.A1Speed);
      a1Filters.push(tempoFilters);
    }

    // Apply volume
    a1Filters.push(`volume=${clip.A1Vol}`);

    filters.push(`[${a1Input}]${a1Filters.join(',')}[a1]`);
    audioInputs.push("[a1]");

    // Secondary audio (A2 - prince)
    if (clip.isA2 && clip.A2) {
      const a2InputIndex = clip.A1 === clip.V1 ? 1 : 2;
      const a2Filters: string[] = [];

      // Reset audio timestamps to prevent sync drift
      a2Filters.push('asetpts=PTS-STARTPTS');

      // Handle async audio/video sync issues
      a2Filters.push('aresample=async=1');

      if ((clip.A2Speed || 1.0) !== 1.0) {
        // Use chained atempo filters for extreme prince speeds
        // Critical for princes that are much longer/shorter than king
        const tempoFilters = this.buildTempoFilters(clip.A2Speed || 1.0);
        a2Filters.push(tempoFilters);
      }

      // Apply volume
      a2Filters.push(`volume=${clip.A2Vol || 1.0}`);

      filters.push(`[${a2InputIndex}:a]${a2Filters.join(',')}[a2]`);
      audioInputs.push("[a2]");
    }

    // Mix audio
    // Use duration=longest to preserve all audio (princes may extend beyond kings)
    if (audioInputs.length > 1) {
      filters.push(`${audioInputs.join("")}amix=inputs=${audioInputs.length}:duration=longest[amix]`);
    } else {
      filters.push(`${audioInputs[0]}anull[amix]`);
    }

    return filters.join(";");
  }

  /**
   * Concatenate clips
   */
  private async concatenateClips(
    clipFiles: string[],
    format: ExportFormat,
    tempDir: string
  ): Promise<string> {
    const concatListPath = path.join(tempDir, "concat.txt");
    const outputPath = path.join(tempDir, "concatenated.mp4");

    const concatList = clipFiles.map((clip) => `file '${clip.replace(/'/g, "'\\''")}'`).join("\n");
    await fs.writeFile(concatListPath, concatList, "utf-8");

    await this.runFFmpeg([
      "-f", "concat",
      "-safe", "0",
      "-i", concatListPath,
      "-c", "copy",
      "-y",
      outputPath,
    ]);

    return outputPath;
  }

  /**
   * Finalize export with subtitles
   */
  private async finalizeExport(
    inputFile: string,
    clips: VideoClip[],
    settings: ExportSettings,
    tempDir: string,
    onProgress: ProgressCallback
  ): Promise<void> {
    const args = ["-i", inputFile];

    if (settings.format === ExportFormat.Video && settings.includeSubtitles) {
      const subtitleFile = await this.createSubtitleFile(clips, settings.subtitleLanguage, tempDir);
      args.push(
        "-vf", `subtitles=${subtitleFile.replace(/\\/g, "\\\\").replace(/:/g, "\\:")}`,
        "-c:v", "libx264",
        "-crf", settings.videoQuality.toString(),
        "-c:a", "copy"
      );
    } else {
      args.push("-c", "copy");
    }

    args.push("-y", settings.outputPath);

    await this.runFFmpeg(args);
  }

  /**
   * Create SRT subtitle file
   */
  private async createSubtitleFile(
    clips: VideoClip[],
    subtitleLanguage: "transcription" | "translation" | "both",
    tempDir: string
  ): Promise<string> {
    const srtPath = path.join(tempDir, "subtitles.srt");
    let counter = 1;
    let cumulativeTime = 0;
    const entries: string[] = [];

    clips.forEach((clip) => {
      if (!clip.subtitle) return;

      const duration = (clip.V1Stop - clip.V1Start) / clip.V1Speed;
      const startTime = this.formatSrtTime(cumulativeTime);
      const endTime = this.formatSrtTime(cumulativeTime + duration);

      entries.push(`${counter++}\n${startTime} --> ${endTime}\n${clip.subtitle}\n`);
      cumulativeTime += duration;
    });

    await fs.writeFile(srtPath, entries.join("\n"), "utf-8");
    return srtPath;
  }

  /**
   * Format time for SRT (HH:MM:SS,mmm)
   */
  private formatSrtTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${millis.toString().padStart(3, "0")}`;
  }

  /**
   * Run FFmpeg command
   */
  private runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", args);
      let stderr = "";

      ffmpeg.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
        }
      });

      ffmpeg.on("error", (error) => {
        reject(new Error(`Failed to spawn FFmpeg: ${error.message}`));
      });
    });
  }
}

export const ffmpegService = new FFmpegService();
