/**
 * ELAN File Handler
 * Utilities for loading and saving ELAN .eaf (XML Annotation Format) files
 */

import xml2js from "xml2js";
import fs from "fs";
import { AnnotationSegment } from "../../components/transcription/shared/types";

/**
 * ELAN Annotation interface (simplified)
 */
interface ElanAnnotation {
  ANNOTATION_ID: string;
  TIME_SLOT_REF1: string;
  TIME_SLOT_REF2: string;
  ANNOTATION_VALUE: string;
}

/**
 * ELAN Time Slot interface
 */
interface ElanTimeSlot {
  $: {
    TIME_SLOT_ID: string;
    TIME_VALUE: string;
  };
}

/**
 * Load and parse an ELAN .eaf file
 * @param filePath Path to the .eaf file
 * @returns Array of AnnotationSegments
 */
export async function loadElanFile(filePath: string): Promise<AnnotationSegment[]> {
  try {
    const xmlContent = fs.readFileSync(filePath, "utf-8");
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlContent);

    const elanDoc = result.ANNOTATION_DOCUMENT;

    // Extract time slots
    const timeSlots: Map<string, number> = new Map();
    if (elanDoc.TIME_ORDER?.[0]?.TIME_SLOT) {
      elanDoc.TIME_ORDER[0].TIME_SLOT.forEach((slot: ElanTimeSlot) => {
        const id = slot.$.TIME_SLOT_ID;
        const timeMs = parseInt(slot.$.TIME_VALUE, 10);
        timeSlots.set(id, timeMs / 1000); // Convert to seconds
      });
    }

    // Extract annotations from tiers
    // Accept external .eaf files as-is with flexible tier matching
    const segments: AnnotationSegment[] = [];
    if (elanDoc.TIER) {
      const tiers = Array.isArray(elanDoc.TIER) ? elanDoc.TIER : [elanDoc.TIER];

      // Find transcription tier (flexible matching for external files)
      const transcriptionTier = tiers.find(
        (tier: any) =>
          tier.$.TIER_ID === "Transcription" || // SayMore/Lameta
          tier.$.TIER_ID === "default" ||
          tier.$.TIER_ID === "transcription" ||
          tier.$.TIER_ID.toLowerCase().includes("transcript") ||
          tier === tiers[0] // Fallback to first tier
      );

      // Find translation tier (flexible matching for external files)
      console.log("Available tiers:", tiers.map((t: any) => t.$.TIER_ID).join(", "));

      const translationTier = tiers.find(
        (tier: any) =>
          tier.$.TIER_ID === "Translation" || // Lameta simple
          tier.$.TIER_ID === "Phrase Free Translation" || // SayMore full
          tier.$.TIER_ID === "translation" ||
          tier.$.TIER_ID.toLowerCase().includes("translat")
      );

      if (translationTier) {
        console.log(`Found translation tier: ${translationTier.$.TIER_ID}`);
      } else {
        console.log("No translation tier found");
      }

      if (transcriptionTier?.ANNOTATION) {
        const annotations = Array.isArray(transcriptionTier.ANNOTATION)
          ? transcriptionTier.ANNOTATION
          : [transcriptionTier.ANNOTATION];

        annotations.forEach((ann: any, index: number) => {
          const alignableAnn = ann.ALIGNABLE_ANNOTATION?.[0];
          if (alignableAnn) {
            const startSlot = alignableAnn.$.TIME_SLOT_REF1;
            const endSlot = alignableAnn.$.TIME_SLOT_REF2;
            const text = alignableAnn.ANNOTATION_VALUE?.[0] || "";

            const start = timeSlots.get(startSlot) || 0;
            const end = timeSlots.get(endSlot) || 0;

            segments.push({
              id: `seg-${index + 1}`,
              start,
              end,
              text,
              translation: "", // Will be filled from translation tier
            });
          }
        });
      }

      // Extract translation annotations and match to segments
      if (translationTier?.ANNOTATION) {
        const translations = Array.isArray(translationTier.ANNOTATION)
          ? translationTier.ANNOTATION
          : [translationTier.ANNOTATION];

        console.log(`Processing ${translations.length} translation annotations for ${segments.length} segments`);

        let translationsMatched = 0;
        translations.forEach((ann: any, index: number) => {
          // Try ALIGNABLE_ANNOTATION first (same timing as transcription)
          let alignableAnn = ann.ALIGNABLE_ANNOTATION?.[0];
          let translationText = alignableAnn?.ANNOTATION_VALUE?.[0] || "";

          // If not found, try REF_ANNOTATION (child of transcription tier)
          if (!alignableAnn && ann.REF_ANNOTATION) {
            const refAnn = ann.REF_ANNOTATION?.[0];
            translationText = refAnn?.ANNOTATION_VALUE?.[0] || "";
            console.log(`  Segment ${index}: Using REF_ANNOTATION - "${translationText}"`);
          }

          if ((alignableAnn || translationText) && segments[index]) {
            segments[index].translation = translationText;
            if (translationText) {
              console.log(`  Segment ${index}: "${translationText}"`);
              translationsMatched++;
            }
          } else {
            console.log(`  Segment ${index}: No match (alignableAnn=${!!alignableAnn}, refAnn=${!!ann.REF_ANNOTATION}, segmentExists=${!!segments[index]})`);
          }
        });

        console.log(`Matched ${translationsMatched} translations to segments`);
      }
    }

    console.log(`Loaded ${segments.length} segments from ELAN file`);
    return segments;
  } catch (error) {
    console.error("Error loading ELAN file:", error);
    throw error;
  }
}

/**
 * Adjust segment boundaries based on existing annotation files
 * Scans the _Annotations folder and updates segment start/end times to match annotation files
 * @param segments Current segments
 * @param annotationsDir Path to the _Annotations folder
 * @returns Updated segments with corrected boundaries
 */
export function adjustSegmentBoundariesFromAnnotations(
  segments: AnnotationSegment[],
  annotationsDir: string
): AnnotationSegment[] {
  if (!fs.existsSync(annotationsDir)) {
    console.log("Annotations directory does not exist, skipping adjustment");
    return segments;
  }

  const path = require("path");
  const files = fs.readdirSync(annotationsDir);

  // Parse annotation filenames to extract timing info
  // Format: {start}_to_{end}_Careful.wav or {start}_to_{end}_Translation.wav
  const annotationTimings = new Map<string, { start: number; end: number }>();

  files.forEach((filename: string) => {
    const match = filename.match(/^(\d+\.?\d*)_to_(\d+\.?\d*)_(Careful|Translation)\.wav$/);
    if (match) {
      const start = parseFloat(match[1]);
      const end = parseFloat(match[2]);
      const key = `${start}_${end}`;
      annotationTimings.set(key, { start, end });
    }
  });

  console.log(`Found ${annotationTimings.size} unique segment timings from annotation files`);

  // For each segment, find the closest matching annotation timing
  const updatedSegments = segments.map((segment, index) => {
    let bestMatch: { start: number; end: number } | null = null;
    let bestDistance = Infinity;

    // Find annotation with closest timing match
    annotationTimings.forEach((timing) => {
      const distance = Math.abs(timing.start - segment.start) + Math.abs(timing.end - segment.end);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = timing;
      }
    });

    // If we found a close match (within 1 second total difference), use it
    if (bestMatch && bestDistance < 1.0) {
      console.log(`Segment ${index}: Adjusting ${segment.start}-${segment.end} to ${bestMatch.start}-${bestMatch.end}`);
      return {
        ...segment,
        start: bestMatch.start,
        end: bestMatch.end,
      };
    }

    return segment;
  });

  return updatedSegments;
}

/**
 * Save segments to an ELAN .eaf file
 * Uses SayMore's simple tier naming: "Transcription" and "Translation"
 * @param filePath Path where to save the .eaf file
 * @param segments Array of annotation segments to save
 * @param mediaFilePath Path to the media file (referenced in ELAN)
 */
export async function saveElanFile(
  filePath: string,
  segments: AnnotationSegment[],
  mediaFilePath: string
): Promise<void> {
  try {
    // Build ELAN structure
    const elanDoc: any = {
      ANNOTATION_DOCUMENT: {
        $: {
          AUTHOR: "Lameta",
          DATE: new Date().toISOString(),
          FORMAT: "3.0",
          VERSION: "3.0",
          "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
          "xsi:noNamespaceSchemaLocation":
            "http://www.mpi.nl/tools/elan/EAFv3.0.xsd",
        },
        HEADER: {
          $: {
            MEDIA_FILE: "",
            TIME_UNITS: "milliseconds",
          },
          MEDIA_DESCRIPTOR: {
            $: {
              MEDIA_URL: `file:///${mediaFilePath.replace(/\\/g, "/")}`,
              MIME_TYPE: "audio/x-wav",
              RELATIVE_MEDIA_URL: mediaFilePath.split(/[/\\]/).pop(),
            },
          },
        },
        TIME_ORDER: {
          TIME_SLOT: [] as any[],
        },
        TIER: [] as any[], // Multiple tiers like SayMore
        LINGUISTIC_TYPE: {
          $: {
            GRAPHIC_REFERENCES: "false",
            LINGUISTIC_TYPE_ID: "default-lt",
            TIME_ALIGNABLE: "true",
          },
        },
        CONSTRAINT: [
          {
            $: {
              DESCRIPTION: "Time subdivision of parent annotation's time interval, no time gaps allowed within this interval",
              STEREOTYPE: "Time_Subdivision",
            },
          },
          {
            $: {
              DESCRIPTION: "Symbolic subdivision of a parent annotation",
              STEREOTYPE: "Symbolic_Subdivision",
            },
          },
        ],
      },
    };

    // Create transcription tier (SayMore naming)
    const transcriptionTier: any = {
      $: {
        DEFAULT_LOCALE: "en",
        LINGUISTIC_TYPE_REF: "default-lt",
        TIER_ID: "Transcription",
      },
      ANNOTATION: [] as any[],
    };

    // Create translation tier (SayMore exact naming)
    const translationTier: any = {
      $: {
        DEFAULT_LOCALE: "en",
        LINGUISTIC_TYPE_REF: "default-lt",
        TIER_ID: "Phrase Free Translation", // Matches SayMore's TextTier.ElanTranslationTierId
      },
      ANNOTATION: [] as any[],
    };

    // Create time slots and annotations
    segments.forEach((segment, index) => {
      const startSlotId = `ts${index * 2 + 1}`;
      const endSlotId = `ts${index * 2 + 2}`;

      // Add time slots
      elanDoc.ANNOTATION_DOCUMENT.TIME_ORDER.TIME_SLOT.push({
        $: {
          TIME_SLOT_ID: startSlotId,
          TIME_VALUE: Math.round(segment.start * 1000).toString(),
        },
      });
      elanDoc.ANNOTATION_DOCUMENT.TIME_ORDER.TIME_SLOT.push({
        $: {
          TIME_SLOT_ID: endSlotId,
          TIME_VALUE: Math.round(segment.end * 1000).toString(),
        },
      });

      // Add transcription annotation
      transcriptionTier.ANNOTATION.push({
        ALIGNABLE_ANNOTATION: {
          $: {
            ANNOTATION_ID: `${segment.id}_tx`,
            TIME_SLOT_REF1: startSlotId,
            TIME_SLOT_REF2: endSlotId,
          },
          ANNOTATION_VALUE: segment.text || "",
        },
      });

      // Add translation annotation (if present)
      translationTier.ANNOTATION.push({
        ALIGNABLE_ANNOTATION: {
          $: {
            ANNOTATION_ID: `${segment.id}_tr`,
            TIME_SLOT_REF1: startSlotId,
            TIME_SLOT_REF2: endSlotId,
          },
          ANNOTATION_VALUE: segment.translation || "",
        },
      });
    });

    // Add tiers to document (SayMore style: Transcription, then Translation)
    elanDoc.ANNOTATION_DOCUMENT.TIER.push(transcriptionTier);
    elanDoc.ANNOTATION_DOCUMENT.TIER.push(translationTier);

    // Build XML
    const builder = new xml2js.Builder({
      xmldec: {
        version: "1.0",
        encoding: "UTF-8",
      },
    });
    const xml = builder.buildObject(elanDoc);

    // Write file
    fs.writeFileSync(filePath, xml, "utf-8");
    console.log(`Saved ${segments.length} segments to ELAN file: ${filePath}`);
  } catch (error) {
    console.error("Error saving ELAN file:", error);
    throw error;
  }
}

/**
 * Check if a file is an ELAN file by extension
 */
export function isElanFile(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".eaf");
}

/**
 * Generate ELAN file path from media file path
 * Tries multiple naming patterns:
 * 1. {mediaFile}.eaf - Lameta format
 * 2. {mediaFile}.annotations.eaf - SayMore format
 * 3. ANY .eaf file in the same directory (fallback for video using audio's ELAN file)
 */
export function getElanFilePath(mediaFilePath: string): string {
  const path = require("path");
  const fs = require("fs");

  const mediaDir = path.dirname(mediaFilePath);
  const mediaBaseName = path.basename(mediaFilePath, path.extname(mediaFilePath));
  const mediaFileWithExt = path.basename(mediaFilePath);

  // Try multiple patterns
  const patterns = [
    path.join(mediaDir, `${mediaBaseName}.eaf`),                    // Lameta: video.eaf
    path.join(mediaDir, `${mediaFileWithExt}.annotations.eaf`),     // SayMore: video.mp4.annotations.eaf
    path.join(mediaDir, `${mediaBaseName}.annotations.eaf`),        // SayMore: video.annotations.eaf
  ];

  // Normalize spaces/underscores for each pattern
  for (const pattern of patterns) {
    const variants = [
      pattern,
      pattern.replace(/_/g, " "),
      pattern.replace(/ /g, "_")
    ];

    for (const variant of variants) {
      if (fs.existsSync(variant)) {
        console.log(`Found ELAN file: ${variant}`);
        return variant;
      }
    }
  }

  // Fallback: look for ANY .eaf file in the directory
  // This handles cases where video uses audio file's ELAN file
  try {
    const files = fs.readdirSync(mediaDir);
    for (const file of files) {
      if (file.endsWith(".eaf") || file.endsWith(".annotations.eaf")) {
        const fullPath = path.join(mediaDir, file);
        console.log(`Found ELAN file (fallback): ${fullPath}`);
        return fullPath;
      }
    }
  } catch (error) {
    console.error("Error scanning for ELAN files:", error);
  }

  // If nothing found, return the default pattern
  console.log(`No ELAN file found, using default: ${patterns[0]}`);
  return patterns[0];
}
