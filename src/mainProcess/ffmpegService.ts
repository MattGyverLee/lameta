/**
 * FFmpeg Service - Video/Audio export with subtitle burning and audio mixing
 * Based on Prestige's ExportVid algorithm
 * Supports kings/princes logic for multi-track audio
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
 * Export settings matching renderer interface
 */
export interface ExportSettings {
  format: ExportFormat;
  includeSubtitles: boolean;
  subtitleLanguage: "transcription" | "translation" | "both";
  outputPath: string;
  videoQuality: number;
  audioBitrate: number;
}

/**
 * Annotation segment matching renderer interface
 */
export interface AnnotationSegment {
  id: string;
  start: number;
  end: number;
  transcription?: string;
  translation?: string;
  carefulSpeechFile?: string;
  oralTranslationFile?: string;
}

/**
 * Audio track matching renderer interface
 */
export interface AudioTrack {
  id: string;
  label: string;
  url: string;
  volume: number;
  muted: boolean;
  isKing: boolean;
}

/**
 * Kings/Princes mode configuration
 */
export interface KingsPrincesMode {
  useKingsPrincesLogic: boolean;
  kingThreshold: number;
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
 * FFmpeg Service Class
 */
export class FFmpegService {
  /**
   * Export video/audio with FFmpeg
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
        // Step 1: Create segment clips
        onProgress({
          stage: "Extracting",
          percent: 10,
          message: `Extracting ${segments.length} segments...`,
        });

        const segmentClips = await this.extractSegmentClips(
          mediaFilePath,
          segments,
          tempDir,
          onProgress
        );

        // Step 2: Process audio tracks (mix with kings/princes logic if needed)
        onProgress({
          stage: "Processing Audio",
          percent: 40,
          message: "Mixing audio tracks...",
        });

        const processedClips = await this.processAudioTracks(
          segmentClips,
          segments,
          tracks,
          kingsPrincesMode,
          settings,
          tempDir,
          onProgress
        );

        // Step 3: Create subtitles if needed
        let subtitleFile: string | undefined;
        if (settings.format === ExportFormat.Video && settings.includeSubtitles) {
          onProgress({
            stage: "Creating Subtitles",
            percent: 60,
            message: "Generating subtitle file...",
          });

          subtitleFile = await this.createSubtitleFile(
            segments,
            settings.subtitleLanguage,
            tempDir
          );
        }

        // Step 4: Concatenate clips
        onProgress({
          stage: "Concatenating",
          percent: 70,
          message: "Combining segments...",
        });

        const concatenatedFile = await this.concatenateClips(
          processedClips,
          settings.format,
          tempDir,
          onProgress
        );

        // Step 5: Apply subtitles and finalize
        onProgress({
          stage: "Finalizing",
          percent: 85,
          message: "Creating final output...",
        });

        await this.finalizeExport(
          concatenatedFile,
          subtitleFile,
          settings,
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
   * Extract individual segment clips from source video
   */
  private async extractSegmentClips(
    mediaFilePath: string,
    segments: AnnotationSegment[],
    tempDir: string,
    onProgress: ProgressCallback
  ): Promise<string[]> {
    const clips: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const outputPath = path.join(tempDir, `segment_${i}.mp4`);

      const duration = segment.end - segment.start;

      await this.runFFmpeg([
        "-i", mediaFilePath,
        "-ss", segment.start.toString(),
        "-t", duration.toString(),
        "-c", "copy",
        "-avoid_negative_ts", "1",
        outputPath,
      ]);

      clips.push(outputPath);

      const progress = 10 + (30 * (i + 1)) / segments.length;
      onProgress({
        stage: "Extracting",
        percent: progress,
        message: `Extracted segment ${i + 1}/${segments.length}`,
      });
    }

    return clips;
  }

  /**
   * Process audio tracks with kings/princes logic
   */
  private async processAudioTracks(
    segmentClips: string[],
    segments: AnnotationSegment[],
    tracks: AudioTrack[],
    kingsPrincesMode: KingsPrincesMode,
    settings: ExportSettings,
    tempDir: string,
    onProgress: ProgressCallback
  ): Promise<string[]> {
    const processedClips: string[] = [];

    // Get active (non-muted) tracks
    const activeTracks = tracks.filter((t) => !t.muted && t.volume > 0);

    if (activeTracks.length === 0) {
      // No audio processing needed, just copy clips
      return segmentClips;
    }

    for (let i = 0; i < segmentClips.length; i++) {
      const segment = segments[i];
      const inputClip = segmentClips[i];
      const outputPath = path.join(tempDir, `processed_${i}.mp4`);

      // Build FFmpeg filter for audio mixing
      const audioFilters = await this.buildAudioMixFilter(
        segment,
        activeTracks,
        kingsPrincesMode,
        tempDir
      );

      if (audioFilters.length === 0) {
        // No additional audio processing, copy as is
        processedClips.push(inputClip);
        continue;
      }

      // Apply audio mixing
      const args = ["-i", inputClip];

      // Add additional audio inputs (careful speech, translation)
      const additionalInputs: string[] = [];
      if (segment.carefulSpeechFile && fs.existsSync(segment.carefulSpeechFile)) {
        args.push("-i", segment.carefulSpeechFile);
        additionalInputs.push(segment.carefulSpeechFile);
      }
      if (segment.oralTranslationFile && fs.existsSync(segment.oralTranslationFile)) {
        args.push("-i", segment.oralTranslationFile);
        additionalInputs.push(segment.oralTranslationFile);
      }

      // Build filter complex for audio mixing
      const filterComplex = this.buildFilterComplex(
        activeTracks,
        kingsPrincesMode,
        additionalInputs.length
      );

      args.push(
        "-filter_complex", filterComplex,
        "-map", "0:v",  // Keep video from first input
        "-map", "[amix]", // Use mixed audio
        "-c:v", "copy",  // Copy video stream
        "-c:a", "aac",   // Encode audio as AAC
        "-b:a", `${settings.audioBitrate}k`,
        outputPath
      );

      await this.runFFmpeg(args);
      processedClips.push(outputPath);

      const progress = 40 + (20 * (i + 1)) / segmentClips.length;
      onProgress({
        stage: "Processing Audio",
        percent: progress,
        message: `Processed audio for segment ${i + 1}/${segmentClips.length}`,
      });
    }

    return processedClips;
  }

  /**
   * Build audio mix filter for segment
   */
  private async buildAudioMixFilter(
    segment: AnnotationSegment,
    activeTracks: AudioTrack[],
    kingsPrincesMode: KingsPrincesMode,
    tempDir: string
  ): Promise<string[]> {
    // This will be expanded based on which tracks have files
    const filters: string[] = [];

    // Check which optional tracks exist
    const hasCarefulSpeech = segment.carefulSpeechFile && fs.existsSync(segment.carefulSpeechFile);
    const hasTranslation = segment.oralTranslationFile && fs.existsSync(segment.oralTranslationFile);

    return filters;
  }

  /**
   * Build FFmpeg filter_complex for audio mixing with kings/princes logic
   */
  private buildFilterComplex(
    activeTracks: AudioTrack[],
    kingsPrincesMode: KingsPrincesMode,
    additionalInputCount: number
  ): string {
    const filters: string[] = [];
    const inputIndex = 0;

    // Process each active track
    activeTracks.forEach((track, trackIndex) => {
      const volume = track.volume / 100; // Convert 0-100 to 0-1

      // Determine playback speed based on kings/princes logic
      let speed = 1.0;
      if (kingsPrincesMode.useKingsPrincesLogic && !track.isKing) {
        speed = 0.75; // Princes play at 75% speed
      }

      const actualInputIndex = trackIndex > 0 ? inputIndex + trackIndex : 0;

      // Build filter chain for this track
      let filter = `[${actualInputIndex}:a]`;

      // Apply speed adjustment if needed
      if (speed !== 1.0) {
        filter += `atempo=${speed}`;
      }

      // Apply volume
      if (volume !== 1.0 || speed !== 1.0) {
        if (speed !== 1.0) filter += ",";
        filter += `volume=${volume}`;
      }

      filter += `[a${trackIndex}]`;
      filters.push(filter);
    });

    // Mix all processed tracks
    const mixInputs = activeTracks.map((_, i) => `[a${i}]`).join("");
    filters.push(`${mixInputs}amix=inputs=${activeTracks.length}:duration=first[amix]`);

    return filters.join(";");
  }

  /**
   * Create subtitle file in ASS format
   */
  private async createSubtitleFile(
    segments: AnnotationSegment[],
    subtitleLanguage: "transcription" | "translation" | "both",
    tempDir: string
  ): Promise<string> {
    const subtitlePath = path.join(tempDir, "subtitles.ass");

    // ASS file header
    let assContent = `[Script Info]
Title: Lameta Export
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Transcription,Arial,24,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1
Style: Translation,Arial,20,&H00FFFF00,&H000000FF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,2,1,8,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    // Calculate cumulative time for each segment
    let cumulativeTime = 0;

    for (const segment of segments) {
      const duration = segment.end - segment.start;
      const startTime = this.formatAssTime(cumulativeTime);
      const endTime = this.formatAssTime(cumulativeTime + duration);

      if (subtitleLanguage === "transcription" || subtitleLanguage === "both") {
        const text = segment.transcription || "";
        assContent += `Dialogue: 0,${startTime},${endTime},Transcription,,0,0,0,,${this.escapeAssText(text)}\n`;
      }

      if (subtitleLanguage === "translation" || subtitleLanguage === "both") {
        const text = segment.translation || "";
        assContent += `Dialogue: 0,${startTime},${endTime},Translation,,0,0,0,,${this.escapeAssText(text)}\n`;
      }

      cumulativeTime += duration;
    }

    await fs.writeFile(subtitlePath, assContent, "utf-8");
    return subtitlePath;
  }

  /**
   * Format time in ASS format (H:MM:SS.CC)
   */
  private formatAssTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const centisecs = Math.floor((seconds % 1) * 100);

    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${centisecs.toString().padStart(2, "0")}`;
  }

  /**
   * Escape text for ASS subtitles
   */
  private escapeAssText(text: string): string {
    return text.replace(/\n/g, "\\N").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
  }

  /**
   * Concatenate video clips
   */
  private async concatenateClips(
    clips: string[],
    format: ExportFormat,
    tempDir: string,
    onProgress: ProgressCallback
  ): Promise<string> {
    const concatListPath = path.join(tempDir, "concat.txt");
    const outputPath = path.join(tempDir, format === ExportFormat.Video ? "concatenated.mp4" : "concatenated.mp3");

    // Create concat demuxer file
    const concatList = clips.map((clip) => `file '${clip.replace(/'/g, "'\\''")}'`).join("\n");
    await fs.writeFile(concatListPath, concatList, "utf-8");

    const args = [
      "-f", "concat",
      "-safe", "0",
      "-i", concatListPath,
    ];

    if (format === ExportFormat.Video) {
      args.push("-c", "copy");
    } else {
      args.push("-vn", "-c:a", "libmp3lame");
    }

    args.push(outputPath);

    await this.runFFmpeg(args);

    return outputPath;
  }

  /**
   * Finalize export with subtitle burning and quality settings
   */
  private async finalizeExport(
    inputFile: string,
    subtitleFile: string | undefined,
    settings: ExportSettings,
    onProgress: ProgressCallback
  ): Promise<void> {
    const args = ["-i", inputFile];

    if (settings.format === ExportFormat.Video) {
      // Video export
      if (subtitleFile) {
        // Burn subtitles into video
        args.push(
          "-vf", `ass=${subtitleFile.replace(/\\/g, "\\\\").replace(/:/g, "\\:")}`,
          "-c:v", "libx264",
          "-crf", settings.videoQuality.toString(),
          "-preset", "medium",
          "-c:a", "copy"
        );
      } else {
        // No subtitles, just re-encode if needed
        args.push(
          "-c:v", "libx264",
          "-crf", settings.videoQuality.toString(),
          "-preset", "medium",
          "-c:a", "copy"
        );
      }
    } else {
      // Audio-only export
      args.push(
        "-vn",
        "-c:a", "libmp3lame",
        "-b:a", `${settings.audioBitrate}k`
      );
    }

    args.push("-y", settings.outputPath);

    await this.runFFmpeg(args, (progress) => {
      onProgress({
        stage: "Finalizing",
        percent: 85 + (progress * 0.15),
        message: `Encoding final output... ${Math.round(progress)}%`,
      });
    });
  }

  /**
   * Run FFmpeg command
   */
  private runFFmpeg(args: string[], onProgress?: (percent: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", args);

      let stderr = "";

      ffmpeg.stderr.on("data", (data) => {
        stderr += data.toString();

        // Parse progress from FFmpeg output
        if (onProgress) {
          const timeMatch = stderr.match(/time=(\d+):(\d+):(\d+\.\d+)/);
          if (timeMatch) {
            const hours = parseInt(timeMatch[1], 10);
            const minutes = parseInt(timeMatch[2], 10);
            const seconds = parseFloat(timeMatch[3]);
            const currentTime = hours * 3600 + minutes * 60 + seconds;

            // This is approximate - we don't know the total duration
            // Could be improved by parsing duration from FFmpeg output
            const percent = Math.min(currentTime / 10 * 100, 99);
            onProgress(percent);
          }
        }
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
