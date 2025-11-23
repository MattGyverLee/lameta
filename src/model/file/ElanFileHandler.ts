/**
 * ELAN File Handler
 * Utilities for loading and saving ELAN .eaf (XML Annotation Format) files
 */

import xml2js from "xml2js";
import fs from "fs";
import { AnnotationSegment } from "../components/transcription/shared/types";

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
    const segments: AnnotationSegment[] = [];
    if (elanDoc.TIER) {
      const tiers = Array.isArray(elanDoc.TIER) ? elanDoc.TIER : [elanDoc.TIER];

      // Find transcription tier (typically first tier or tier named "default")
      const transcriptionTier = tiers.find(
        (tier: any) =>
          tier.$.TIER_ID === "default" ||
          tier.$.TIER_ID === "transcription" ||
          tier === tiers[0]
      );

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
              translation: "",
            });
          }
        });
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
 * Save segments to an ELAN .eaf file
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
        TIER: {
          $: {
            DEFAULT_LOCALE: "en",
            LINGUISTIC_TYPE_REF: "default-lt",
            TIER_ID: "default",
          },
          ANNOTATION: [] as any[],
        },
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

      // Add annotation
      elanDoc.ANNOTATION_DOCUMENT.TIER.ANNOTATION.push({
        ALIGNABLE_ANNOTATION: {
          $: {
            ANNOTATION_ID: segment.id,
            TIME_SLOT_REF1: startSlotId,
            TIME_SLOT_REF2: endSlotId,
          },
          ANNOTATION_VALUE: segment.text || "",
        },
      });
    });

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
 * e.g., "video.mp4" -> "video.eaf"
 */
export function getElanFilePath(mediaFilePath: string): string {
  return mediaFilePath.replace(/\.[^.]+$/, ".eaf");
}
