/**
 * One-time script to fix ELAN segment boundaries to match annotation files
 * Usage: node fix-elan-boundaries.js
 */

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

// Configuration
const sessionDir = 'D:\\thoua\\Documents\\SayMore\\French Transcription\\Sessions\\Pourquoi_un_metre_mesure_1m';
const annotationsDir = 'D:\\thoua\\Documents\\SayMore\\French Transcription\\Sessions\\Pourquoi_un_metre_mesure_1m\\Pourquoi_un_mètre_mesure_1m_Source_01_StandardAudio.wav_Annotations';

// Find the .eaf file (may have Unicode variations)
const sessionFiles = fs.readdirSync(sessionDir);
const eafFiles = sessionFiles.filter(f => f.endsWith('.eaf') && f.includes('Source_01'));
if (eafFiles.length === 0) {
  console.error('ERROR: Could not find .eaf file in session directory!');
  console.log('Files in directory:', sessionFiles);
  process.exit(1);
}
const eafFile = path.join(sessionDir, eafFiles[0]);

console.log('=== ELAN Boundary Fixer ===');
console.log(`Session directory: ${sessionDir}`);
console.log(`Annotations directory: ${annotationsDir}`);
console.log(`ELAN file: ${eafFile}`);
console.log('');

// Step 1: Read annotation files to get correct timings
console.log('Step 1: Scanning annotation files...');
const files = fs.readdirSync(annotationsDir);
const annotationTimings = [];

files.forEach((filename) => {
  const match = filename.match(/^(\d+\.?\d*)_to_(\d+\.?\d*)_(Careful|Translation)\.wav$/);
  if (match) {
    const start = parseFloat(match[1]);
    const end = parseFloat(match[2]);
    const type = match[3];

    // Check if we already have this timing
    const existing = annotationTimings.find(t => t.start === start && t.end === end);
    if (!existing) {
      annotationTimings.push({ start, end });
    }
  }
});

// Sort by start time
annotationTimings.sort((a, b) => a.start - b.start);

console.log(`Found ${annotationTimings.length} unique segment timings:`);
annotationTimings.forEach((t, i) => {
  console.log(`  ${i + 1}. ${t.start} -> ${t.end}`);
});
console.log('');

// Step 2: Load ELAN file
console.log('Step 2: Loading ELAN file...');
const xmlContent = fs.readFileSync(eafFile, 'utf-8');
const parser = new xml2js.Parser();

parser.parseString(xmlContent, (err, result) => {
  if (err) {
    console.error('Error parsing ELAN file:', err);
    return;
  }

  const elanDoc = result.ANNOTATION_DOCUMENT;

  // Extract current time slots
  const timeSlots = new Map();
  if (elanDoc.TIME_ORDER?.[0]?.TIME_SLOT) {
    elanDoc.TIME_ORDER[0].TIME_SLOT.forEach((slot) => {
      const id = slot.$.TIME_SLOT_ID;
      const timeMs = parseInt(slot.$.TIME_VALUE, 10);
      timeSlots.set(id, timeMs / 1000); // Convert to seconds
    });
  }

  console.log(`Current ELAN file has ${timeSlots.size} time slots`);
  console.log('');

  // Extract current segments
  const tiers = elanDoc.TIER || [];
  const transcriptionTier = tiers.find(t =>
    t.$.TIER_ID === 'Transcription' ||
    t.$.TIER_ID === 'Phrase' ||
    t.$.TIER_ID.toLowerCase().includes('transcr')
  );

  if (!transcriptionTier) {
    console.error('Could not find transcription tier!');
    return;
  }

  const annotations = Array.isArray(transcriptionTier.ANNOTATION)
    ? transcriptionTier.ANNOTATION
    : [transcriptionTier.ANNOTATION];

  console.log(`Step 3: Analyzing ${annotations.length} current segments...`);
  const currentSegments = annotations.map((ann, i) => {
    const alignableAnn = ann.ALIGNABLE_ANNOTATION?.[0];
    if (!alignableAnn) return null;

    const startSlot = alignableAnn.$.TIME_SLOT_REF1;
    const endSlot = alignableAnn.$.TIME_SLOT_REF2;
    const start = timeSlots.get(startSlot);
    const end = timeSlots.get(endSlot);
    const text = alignableAnn.ANNOTATION_VALUE?.[0] || '';

    return { index: i, startSlot, endSlot, start, end, text };
  }).filter(s => s !== null);

  console.log('Current segments:');
  currentSegments.forEach(s => {
    console.log(`  ${s.index + 1}. ${s.start} -> ${s.end}: "${s.text}"`);
  });
  console.log('');

  // Step 4: Match and update
  console.log('Step 4: Matching segments to annotation timings...');
  const updates = [];

  currentSegments.forEach((segment) => {
    let bestMatch = null;
    let bestDistance = Infinity;

    annotationTimings.forEach((timing) => {
      const distance = Math.abs(timing.start - segment.start) + Math.abs(timing.end - segment.end);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = timing;
      }
    });

    if (bestMatch && bestDistance < 1.0) {
      updates.push({
        segment,
        newStart: bestMatch.start,
        newEnd: bestMatch.end,
        distance: bestDistance
      });
      console.log(`  Segment ${segment.index + 1}: ${segment.start}-${segment.end} -> ${bestMatch.start}-${bestMatch.end} (distance: ${bestDistance.toFixed(3)})`);
    } else {
      console.log(`  Segment ${segment.index + 1}: No close match found (best distance: ${bestDistance.toFixed(3)})`);
    }
  });

  console.log('');
  console.log(`Step 5: Applying ${updates.length} updates to ELAN file...`);

  // Update time slots
  const timeSlotUpdates = new Map();
  updates.forEach(update => {
    timeSlotUpdates.set(update.segment.startSlot, update.newStart * 1000); // Convert to ms
    timeSlotUpdates.set(update.segment.endSlot, update.newEnd * 1000);
  });

  elanDoc.TIME_ORDER[0].TIME_SLOT.forEach((slot) => {
    const id = slot.$.TIME_SLOT_ID;
    if (timeSlotUpdates.has(id)) {
      const newTimeMs = timeSlotUpdates.get(id);
      console.log(`  Updating ${id}: ${slot.$.TIME_VALUE}ms -> ${newTimeMs}ms`);
      slot.$.TIME_VALUE = Math.round(newTimeMs).toString();
    }
  });

  // Step 6: Save updated ELAN file
  const backupFile = eafFile + '.backup';
  console.log('');
  console.log(`Step 6: Saving backup to ${backupFile}...`);
  fs.writeFileSync(backupFile, xmlContent);

  const builder = new xml2js.Builder();
  const updatedXml = builder.buildObject(result);

  console.log(`Saving updated ELAN file to ${eafFile}...`);
  fs.writeFileSync(eafFile, updatedXml);

  console.log('');
  console.log('=== DONE ===');
  console.log('✓ Backup created');
  console.log(`✓ ${updates.length} segments updated`);
  console.log('✓ ELAN file saved');
});
