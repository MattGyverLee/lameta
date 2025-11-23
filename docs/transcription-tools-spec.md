# Lameta Transcription Tools Specification

**Version:** 1.1
**Date:** 2025-11-23 (Updated)
**Author:** Claude (based on SayMore and Prestige analysis)

---

## Executive Summary

This specification outlines the design for integrated audio/video transcription and annotation tools for Lameta. The goal is to port and enhance SayMore's transcription capabilities while incorporating Prestige's multi-layer playback and video export features, using a two-tab interface that separates annotation work from preview/export.

### Key Objectives

1. **Two-tab interface**: "Annotate" tab for transcription work, "Preview" tab for playback/export
2. **SayMore-inspired entry point**: Similar workflow to SayMore's annotation process
3. **Port SayMore's segmentation tools** (auto-segmenter, manual segmentation, text annotation workflow)
4. **Incorporate Prestige's multi-layer features** (WaveSurfer timelines, kings/princes audio mixing, FFmpeg export)
5. **Modern Lameta design system** (clean, minimal UI using Lameta's color palette and components)
6. **Use React hooks** instead of class components
7. **Integrate with existing Lameta architecture** (react-player, ffmpeg, file management, react-tabs)

---

## Table of Contents

1. [Background](#background)
2. [Architecture Overview](#architecture-overview)
3. [Feature Specifications](#feature-specifications)
   - [Auto-Segmentation](#auto-segmentation)
   - [Manual Segmentation](#manual-segmentation)
   - [Transcription Interface](#transcription-interface)
   - [Multi-Layer Playback](#multi-layer-playback)
   - [Video Export](#video-export)
4. [Component Design](#component-design)
5. [Data Model](#data-model)
6. [User Workflows](#user-workflows)
7. [Technical Implementation](#technical-implementation)
8. [Dependencies](#dependencies)

---

## Background

### SayMore (.NET/C#)
- **Transcription tools**: Auto-segmentation, manual segmentation, text annotation grid
- **Problem**: Separates audio from video during transcription
- **Strengths**: Excellent keyboard-driven workflow (Tab/Enter navigation, F2 play/pause), auto-segmentation algorithm

### Prestige (Electron/React)
- **Multi-layer playback**: Synchronized video + 3 WaveSurfer timelines (source, careful, translation)
- **Kings/Princes audio mixing**: Primary tracks control duration, secondary tracks adjusted to match
- **Video export**: FFmpeg-based export with multi-layer audio
- **Strengths**: Video always visible, excellent multi-track visualization

### ELAN
- **Strengths**: Video-centric interface with timeline annotation
- **Inspiration**: Keep video prominent during all annotation work

---

## Architecture Overview

### Two-Tab Interface

The transcription interface is split into two tabs using Lameta's existing `react-tabs` component:

**Tab 1: Annotate** (SayMore-inspired workflow)
- Primary workspace for segmentation and text entry
- Simple, focused interface for transcription work
- Video + single waveform + annotation grid

**Tab 2: Preview** (Prestige-inspired playback)
- Multi-layer playback with volume mixing
- Video export with burned-in subtitles
- Review and sharing interface

---

### Annotate Tab Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Session File: ETR009.mp4                                    │
│  ┌──────────────────┐ ┌──────────────────────────────────┐ │
│  │   Annotate       │ │  Preview                         │ │  ← Tabs
│  └──────────────────┘ └──────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │          [Video Player with Subtitles]                 │ │
│  │              (ReactPlayer)                             │ │
│  │                                                         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Source Audio                                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ [Waveform with segment boundary regions]               │ │
│  │ [Regions are draggable, color-coded by segment]        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ [Auto-segment] [Add Boundary] [Delete] [Merge] [Split]│ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Time   │ Transcription      │ Translation    │ ♪ │ ♪  │ │
│  ├────────┼───────────────────┼────────────────┼───┼────┤ │
│  │ 0:00 ▶ │ Bonjour...        │ Hello...       │ ⏺ │ ⏺  │ │
│  │ 0:05 ▶ │ Comment...        │ How are...     │ ⏺ │ ⏺  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [⏮] [⏯] [⏭] [🔁] Speed: [1x▼] Loop: [3x▼]                │
└─────────────────────────────────────────────────────────────┘
```

### Preview Tab Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Session File: ETR009.mp4                                    │
│  ┌──────────────────┐ ┌──────────────────────────────────┐ │
│  │   Annotate       │ │  Preview                         │ │  ← Tabs
│  └──────────────────┘ └──────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │          [Video Player with Subtitles]                 │ │
│  │              (ReactPlayer)                             │ │
│  │                                                         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Source Audio        Volume: ═════════●═ 90%    [ ] Mute    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ [Waveform with playback regions]                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Careful Speech      Volume: ════●══════ 30%    [ ] Mute    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ [Waveform with oral transcription clips]               │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Oral Translation    Volume: ════════════  0%    [✓] Mute    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ [Empty - no recordings]                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [⏮] [⏯] [⏭] Speed: [1x▼]  │  [Export Video▼]              │
└─────────────────────────────────────────────────────────────┘
```

**Key Design Principles:**
1. **Two-mode interface**: Separate annotation work from preview/sharing
2. **SayMore-inspired entry**: Annotate tab follows SayMore's workflow
3. **Lameta design language**: Clean, minimal UI with standard HTML elements
4. **Color palette**: Use Lameta's CSS variables (session green: #cff09f)
5. **Keyboard-driven**: F2 play/pause, Tab/Enter navigation (SayMore workflow)
6. **Multi-track preview**: Preview tab for playback mixing and export

---

## Feature Specifications

### Auto-Segmentation

**Purpose**: Automatically detect natural pauses in audio to create segment boundaries

#### Algorithm Parameters (from SayMore)

```typescript
interface AutoSegmenterSettings {
  minimumSegmentLengthMs: number;      // Default: 500ms
  maximumSegmentLengthMs: number;      // Default: 10000ms (10 seconds)
  preferredPauseLengthMs: number;      // Default: 200ms
  optimumLengthClampingFactor: number; // Default: 1.5 (0.5-3.0 range)
}
```

**Algorithm:**
1. Load audio file and decode to get waveform samples
2. Calculate RMS (Root Mean Square) energy for sliding windows
3. Identify silence regions where RMS falls below threshold
4. Find pauses within optimal segment length range (midpoint between min/max)
5. Apply clamping factor to favor breaks near the optimal length
6. Create segment boundaries at pause points

**UI Flow:**
1. User clicks "Auto-segment" button
2. Modal shows progress with cancel option
3. Algorithm runs in Web Worker (non-blocking)
4. Results displayed: "Found 47 segments (avg 6.2s)"
5. User can adjust parameters and re-run, or accept

#### Implementation Notes
- Use Web Audio API for waveform analysis
- Run in Web Worker to avoid blocking UI
- Show visual preview of detected segments on waveform before committing

---

### Manual Segmentation

**Purpose**: Allow users to manually add, delete, merge, and split segments

#### Toolbar Actions

1. **Add Segment Boundary**
   - Click waveform at desired position
   - Boundary snaps to nearest zero-crossing (reduces clicks/pops)
   - Keyboard: `Ctrl+B` while paused at position

2. **Delete Segment Boundary**
   - Click on boundary marker and press Delete
   - Merges segments on either side
   - Keyboard: Select segment, press `Ctrl+Delete`

3. **Merge Adjacent Segments**
   - Select two adjacent segments
   - Click "Merge" button
   - Combines transcription text with space separator
   - Keyboard: `Ctrl+M`

4. **Split Segment**
   - Click segment, then click position within it
   - Click "Split" button
   - Creates new boundary, text stays with left segment
   - Keyboard: Position playhead, press `Ctrl+S`

5. **Adjust Segment Boundary**
   - Drag boundary marker on waveform
   - Snap to zero-crossing (optional, toggle with Shift)
   - Real-time audio preview as you drag

#### WaveSurfer Region Configuration

```typescript
const regionConfig = {
  drag: true,          // Allow dragging boundaries
  resize: true,        // Allow resizing by dragging edges
  color: 'rgba(70, 130, 180, 0.2)',  // Semi-transparent steel blue
  showTime: true,      // Show timestamp on hover
  snapToZeroCrossing: true  // Reduce audio artifacts
};
```

---

### Transcription Interface

**Purpose**: Provide efficient keyboard-driven workflow for entering transcription and translation text

#### Grid Layout

| Column | Width | Description | Editable | Keyboard Shortcut |
|--------|-------|-------------|----------|-------------------|
| Time | 80px | Start time (MM:SS) with play button | No | Click to play |
| Transcription | 35% | Source language text | Yes | Tab to focus |
| Translation | 35% | Target language text | Yes | Tab to focus |
| Careful Speech | 60px | Play button for oral transcription | No | Click to play |
| Oral Translation | 60px | Play button for oral translation | No | Click to play |

#### Keyboard Workflow (SayMore-inspired)

1. **Tab**: Move to next field (Time → Transcription → Translation → Careful → Oral → next segment)
2. **Shift+Tab**: Move to previous field
3. **Enter**:
   - In Transcription column: Move down to next segment's transcription
   - In Translation column: Move down to next segment's translation
4. **F2**: Toggle play/pause for current segment (loops)
5. **F3**: Record careful speech for current segment
6. **F4**: Record oral translation for current segment
7. **Ctrl+Space**: Play from current segment to end
8. **Ctrl+↑/↓**: Navigate segments without playing

#### Auto-Loop Playback

When a segment has focus and user starts typing:
- Segment audio loops automatically (3x default)
- User can adjust loop count in settings
- Press F2 to stop looping
- Typing doesn't interrupt playback

#### Inline Recording

Click "Record" button in Careful Speech or Oral Translation column:
1. Opens mini recording dialog overlay (doesn't hide video)
2. Shows waveform of source segment for reference
3. User records while watching video/listening to source
4. Save stores audio file in `_Annotations` folder with segment timing metadata
5. Recording appears as new audio clip in corresponding WaveSurfer track

---

### Multi-Layer Playback

**Purpose**: Synchronized playback of video, source audio, and oral annotations

#### Track Configuration

```typescript
interface AudioTrack {
  index: number;        // 0 = source, 1 = careful, 2 = translation
  label: string;        // Display name
  volume: number;       // 0.0 - 1.0
  muted: boolean;
  audioUrl?: string;    // URL to audio file (or merged audio for tracks 1-2)
  type: 'king' | 'prince' | 'silent';  // Determined by volume threshold
}

const KING_VOLUME_THRESHOLD = 0.84;  // Volume >= 0.84 = king (primary)
```

#### Kings and Princes Mixing (from Prestige)

**Concept**: Audio tracks are categorized by volume into "kings" (primary) and "princes" (background/voiceover)

- **Kings** (volume >= 0.84): Primary audio tracks that control playback duration
  - Only one king should be active at a time for clarity
  - King's duration determines how long the segment plays

- **Princes** (0 < volume < 0.84): Background voiceover tracks
  - Play simultaneously with king
  - Automatically speed-adjusted to match king's duration
  - Typical use: King = source audio (French), Prince = translation voiceover (English) at 30% volume

- **Silent** (volume == 0): Muted tracks

**Playback Algorithm:**

1. User clicks play on a segment
2. Determine which tracks are kings, princes, and silent based on volume sliders
3. Play king track(s) at normal speed (with global speed multiplier)
4. Calculate prince playback speed to match king duration:
   ```typescript
   princeSpeed = princeDuration / kingDuration
   ```
5. All tracks seek to corresponding positions and play synchronized
6. Video speed adjusted to match primary audio (king 0 or annotation king)

#### Volume Sliders

```
Source     [▓▓▓▓▓▓▓▓▓░] 90%  (King)
Careful    [▓▓▓░░░░░░░] 30%  (Prince)
Translation [░░░░░░░░░░]  0%  (Silent)
```

User can drag sliders during playback to adjust mix in real-time.

---

### Video Export

**Purpose**: Export video with mixed multilingual audio tracks and burned-in subtitles

#### Export Options

1. **Video with Mixed Audio**
   - Input: Video file + segment timeline + volume settings
   - Output: MP4 with mixed audio based on kings/princes configuration
   - Subtitles: Burned-in or embedded SRT

2. **Audio-Only Mix**
   - Input: Source audio + oral annotations + segment timeline
   - Output: MP3 with mixed layers
   - SRT file with timestamps

3. **Separate Audio Tracks** (Advanced)
   - Output: MP4 with multiple audio tracks (user can switch in player)
   - Track 1: Source audio
   - Track 2: Careful speech
   - Track 3: Oral translation

#### FFmpeg Export Algorithm (from Prestige)

For each segment:
1. Determine kings and princes from volume settings
2. For each king:
   - Calculate king audio duration after speed adjustment
   - Calculate video speed to match: `videoSpeed = videoDuration / kingDuration`
   - For each prince:
     - Calculate prince speed to match king: `princeSpeed = princeDuration / kingDuration`
   - Create FFmpeg clip configuration with:
     - Video input: `V1`, time range, speed
     - Audio 1 (king): `A1`, time range, speed, volume
     - Audio 2 (prince): `A2`, time range, speed, volume (if present)
   - Extract subtitle text for this segment
3. Send clip array to Electron main process
4. Main process uses fluent-ffmpeg to:
   - Extract and speed-adjust each clip
   - Mix audio layers with volume scaling
   - Burn in subtitles using ASS filter
   - Concatenate all clips into final output

**Export UI:**
```
┌─────────────────────────────────────────┐
│         Export Video                    │
├─────────────────────────────────────────┤
│ Format: [MP4 ▼]                         │
│ Quality: [High ▼] (1080p, 8 Mbps)      │
│                                         │
│ Audio Mix:                              │
│   ☑ Source audio at 90%                 │
│   ☐ Careful speech at 30%               │
│   ☐ Oral translation at 50%             │
│                                         │
│ Subtitles:                              │
│   ◉ Burn into video (Transcription)     │
│   ○ Burn into video (Translation)       │
│   ○ Separate SRT file                   │
│   ○ No subtitles                        │
│                                         │
│ Speed: [1x ▼]                           │
│                                         │
│ Output: [Choose folder...] [Browse]     │
│                                         │
│   [Cancel]              [Export]        │
└─────────────────────────────────────────┘
```

---

## Component Design

### Entry Point Integration

The transcription tools integrate into Lameta's existing file panel using the same pattern as other file types:

**When user selects an audio/video file:**
1. `FolderPane.tsx` detects media file type (.mp4, .wav, etc.)
2. For files with `.eaf` annotation or manual "Annotate" button click
3. Opens `TranscriptionView.tsx` component
4. Similar to how SayMore opens annotation from file list

### React Component Hierarchy

```
TranscriptionView.tsx (Main Container - uses react-tabs)
├── useTranscriptionState.ts (Custom hook for state management)
├── Tabs (from react-tabs library)
│   ├── Tab: "Annotate" (SayMore-inspired)
│   │   ├── AnnotateTabPanel.tsx
│   │   │   ├── VideoPlayerSection.tsx
│   │   │   │   ├── VideoPlayer.tsx (ReactPlayer wrapper)
│   │   │   │   └── SubtitleOverlay.tsx
│   │   │   ├── WaveformSection.tsx (Single source waveform)
│   │   │   │   ├── useWaveSurfer.ts (Custom hook)
│   │   │   │   └── RegionManager.ts (Segment boundaries)
│   │   │   ├── SegmentationToolbar.tsx
│   │   │   │   ├── AutoSegmentButton.tsx
│   │   │   │   ├── ManualSegmentButtons.tsx
│   │   │   │   └── SegmentationSettings.tsx
│   │   │   ├── AnnotationGrid.tsx
│   │   │   │   ├── useGridNavigation.ts (Keyboard handling)
│   │   │   │   ├── AnnotationRow.tsx
│   │   │   │   │   ├── TimeCell.tsx (Play button + time)
│   │   │   │   │   ├── TranscriptionCell.tsx (Editable text)
│   │   │   │   │   ├── TranslationCell.tsx (Editable text)
│   │   │   │   │   ├── CarefulSpeechCell.tsx (Record button)
│   │   │   │   │   └── OralTranslationCell.tsx (Record button)
│   │   │   │   └── GridContextMenu.tsx
│   │   │   └── PlaybackControls.tsx
│   │   │       ├── TransportControls.tsx (Play, pause, skip)
│   │   │       ├── SpeedControl.tsx
│   │   │       └── LoopControl.tsx
│   │   │
│   └── Tab: "Preview" (Prestige-inspired)
│       ├── PreviewTabPanel.tsx
│       │   ├── VideoPlayerSection.tsx (Shared component)
│       │   │   └── VideoPlayer.tsx (ReactPlayer wrapper)
│       │   ├── MultiTrackWaveformSection.tsx
│       │   │   ├── WaveformTrack.tsx (×3, reusable component)
│       │   │   │   ├── useWaveSurfer.ts (Custom hook)
│       │   │   │   └── VolumeSlider.tsx (Native HTML range input)
│       │   │   └── MuteCheckbox.tsx (Native HTML checkbox)
│       │   ├── PlaybackControls.tsx (Shared component)
│       │   └── ExportButton.tsx
│       │       └── ExportDialog.tsx
│       │           ├── ExportSettings.tsx
│       │           ├── ExportProgress.tsx
│       │           └── useVideoExport.ts (Export logic hook)
└── RecordingDialog.tsx (Shared - opens as modal)
    ├── RecordingControls.tsx
    └── useMediaRecorder.ts
```

### Lameta Design System Integration

**CSS Variables (from `/src/colors.css`):**
```css
:root {
  --session--color: #cff09f;           /* Light green for session items */
  --accent-color: #e69664;             /* Orange accent */
  --link--color: #216ba5;              /* Link blue */
  --error-color: #dc322f;              /* Error red */
  --pane__border--color: #abadb3;      /* Border gray */
  --search-highlight: #ffba8a;         /* Highlight orange */
}
```

**Component Styling:**
- Use standard HTML elements (`<button>`, `<input>`, `<select>`)
- Apply Lameta CSS classes where applicable
- Use CSS modules for component-specific styles (e.g., `TranscriptionView.css`)
- Volume sliders: Native HTML `<input type="range">` styled with CSS
- No Material-UI, Ant Design, or other heavy UI libraries

**Example Button Styling:**
```tsx
<button
  className="lameta-button session-action"
  onClick={handleAutoSegment}
>
  Auto-segment
</button>
```

**Example Volume Slider:**
```tsx
<div className="volume-control">
  <label>Source Audio</label>
  <input
    type="range"
    min="0"
    max="100"
    value={volume}
    onChange={(e) => setVolume(parseInt(e.target.value))}
    className="volume-slider"
  />
  <span className="volume-value">{volume}%</span>
</div>
```

**Color Usage:**
- Segment regions on waveform: Use `--session--color` with alpha transparency
- Active segment: Brighter version of session color
- Buttons: Use existing Lameta button styles
- Links: Use `--link--color`
- Errors/warnings: Use `--error-color`

---

### Key Custom Hooks

#### `useTranscriptionState.ts`
```typescript
interface TranscriptionState {
  segments: AnnotationSegment[];
  currentSegmentIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  volumes: [number, number, number];  // Track volumes
  currentTime: number;
}

function useTranscriptionState(sessionFile: SessionFile) {
  const [state, dispatch] = useReducer(transcriptionReducer, initialState);

  const autoSegment = useCallback((settings: AutoSegmenterSettings) => {
    // Run auto-segmentation algorithm
  }, []);

  const addSegmentBoundary = useCallback((time: number) => {
    // Add manual segment boundary
  }, []);

  const updateSegmentText = useCallback((
    index: number,
    field: 'transcription' | 'translation',
    text: string
  ) => {
    // Update segment text
  }, []);

  return {
    state,
    autoSegment,
    addSegmentBoundary,
    updateSegmentText,
    // ... other actions
  };
}
```

#### `useWaveSurfer.ts`
```typescript
function useWaveSurfer(
  containerRef: RefObject<HTMLDivElement>,
  audioUrl: string,
  trackIndex: number
) {
  const [wavesurfer, setWavesurfer] = useState<WaveSurfer | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#ddd',
      progressColor: '#4a90e2',
      height: 80,
      normalize: true,
      plugins: [
        RegionsPlugin.create()
      ]
    });

    ws.on('ready', () => setIsReady(true));
    ws.load(audioUrl);

    setWavesurfer(ws);

    return () => ws.destroy();
  }, [containerRef, audioUrl]);

  return { wavesurfer, isReady };
}
```

#### `useGridNavigation.ts`
```typescript
function useGridNavigation(
  gridRef: RefObject<HTMLDivElement>,
  segments: AnnotationSegment[],
  onPlay: (index: number) => void
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'F2':
          e.preventDefault();
          onPlay(currentIndex);
          break;
        case 'Tab':
          e.preventDefault();
          // Move to next cell
          break;
        case 'Enter':
          e.preventDefault();
          // Move to next row, same column
          break;
        // ... other keys
      }
    };

    gridRef.current?.addEventListener('keydown', handleKeyDown);
    return () => gridRef.current?.removeEventListener('keydown', handleKeyDown);
  }, [gridRef, onPlay, currentIndex]);
}
```

---

## Data Model

### File Structure

```
Sessions/
  ETR009/
    ETR009.mp4                          # Source video
    ETR009_Source.wav                   # Source audio (extracted or recorded separately)
    ETR009.eaf                          # ELAN annotation file (primary format)
    ETR009.wav.annotations.eaf          # SayMore format (for compatibility)
    _Annotations/                       # Oral annotation audio files
      ETR009_Careful_Merged.mp3         # Merged careful speech recordings
      ETR009_Translation_Merged.mp3     # Merged oral translation recordings
      segments/                         # Individual segment recordings
        segment_001_careful.mp3
        segment_001_translation.mp3
        segment_002_careful.mp3
        ...
```

### ELAN (.eaf) Format Integration

Lameta already recognizes ELAN files. We'll extend support to read/write ELAN files for transcription:

```xml
<ANNOTATION_DOCUMENT>
  <TIER TIER_ID="Transcription" LINGUISTIC_TYPE_REF="text">
    <ANNOTATION>
      <ALIGNABLE_ANNOTATION TIME_SLOT_REF1="ts1" TIME_SLOT_REF2="ts2">
        <ANNOTATION_VALUE>Bonjour, comment allez-vous?</ANNOTATION_VALUE>
      </ALIGNABLE_ANNOTATION>
    </ANNOTATION>
  </TIER>
  <TIER TIER_ID="Translation" PARENT_REF="Transcription">
    <ANNOTATION>
      <REF_ANNOTATION ANNOTATION_REF="a1">
        <ANNOTATION_VALUE>Hello, how are you?</ANNOTATION_VALUE>
      </REF_ANNOTATION>
    </ANNOTATION>
  </TIER>
  <TIER TIER_ID="CarefulMerged" LINGUISTIC_TYPE_REF="audio">
    <ANNOTATION>
      <ALIGNABLE_ANNOTATION TIME_SLOT_REF1="ts1" TIME_SLOT_REF2="ts2">
        <ANNOTATION_VALUE>file:///.../segment_001_careful.mp3#t0.0,4.2</ANNOTATION_VALUE>
      </ALIGNABLE_ANNOTATION>
    </ANNOTATION>
  </TIER>
  <!-- ... -->
</ANNOTATION_DOCUMENT>
```

### In-Memory Data Model

```typescript
interface AnnotationSegment {
  id: string;                    // Unique ID
  startTime: number;             // Seconds
  stopTime: number;              // Seconds
  transcription: string;         // Source language text
  translation: string;           // Target language text
  carefulSpeechUrl?: string;     // URL to careful speech audio (with #t=start,end fragment)
  oralTranslationUrl?: string;   // URL to oral translation audio
  metadata?: {
    speaker?: string;
    tags?: string[];
  };
}

interface TranscriptionSession {
  videoUrl: string;
  audioUrl: string;
  segments: AnnotationSegment[];
  settings: {
    transcriptionLanguage: string;
    translationLanguage: string;
    fonts: {
      transcription: string;
      translation: string;
    };
  };
}
```

---

## User Workflows

### Workflow 1: Create Transcription from Scratch

1. **Open session** in Lameta
2. **Navigate to Transcription tab** (new tab in session view)
3. **Load video/audio file** (if not already associated)
4. **Auto-segment**:
   - Click "Auto-segment" button
   - Adjust parameters if needed (min/max length, pause sensitivity)
   - Review detected segments on waveform
   - Accept or re-run with different settings
5. **Manual adjustment**:
   - Drag segment boundaries to refine
   - Split long segments
   - Merge short segments
   - Delete incorrect boundaries
6. **Transcribe**:
   - Click first segment (starts looping playback)
   - Type transcription while watching video and listening
   - Press Tab to move to translation field
   - Type translation
   - Press Enter to move to next segment's transcription
   - Repeat for all segments
7. **(Optional) Record oral annotations**:
   - Click "Record" in Careful Speech column
   - Speak careful pronunciation while watching video
   - Save recording
   - Click "Record" in Oral Translation column
   - Speak translation while watching video
   - Save recording
8. **Export**:
   - Click "Export Video" button
   - Choose audio mix (source + translation voiceover at 30%)
   - Choose subtitle language (transcription or translation)
   - Export to file

### Workflow 2: Import Existing ELAN Annotations

1. **Open session** with existing `.eaf` file
2. **Navigate to Transcription tab**
3. **Lameta auto-loads** ELAN annotations:
   - Segments from time tier
   - Transcription from Transcription tier
   - Translation from Translation tier
4. **Continue editing** as in Workflow 1
5. **Save** updates back to `.eaf` file

### Workflow 3: Create Oral Translation for Community Sharing

1. **Open transcribed session** (from Workflow 1)
2. **Set up audio mix**:
   - Mute source audio (volume = 0%)
   - Enable transcription oral annotations (volume = 100%)
   - Enable translation oral annotations (volume = 30% as voiceover)
3. **Export video**:
   - Choose "Video with mixed audio"
   - Burn in translation subtitles
   - Export

Result: Video with oral transcription as primary audio, oral translation as background voiceover, and translation text as subtitles.

This enables community members to:
- Hear careful pronunciation in source language
- Hear translation in target language
- Read translation text as subtitles

---

## Technical Implementation

### Phase 1: Foundation (Weeks 1-2)

**Goal**: Set up basic transcription UI with video playback

**Tasks**:
1. Create `TranscriptionView.tsx` component with layout
2. Integrate `react-player` for video playback
3. Add single WaveSurfer.js track for source audio
4. Implement basic segment data model (in-memory)
5. Create `AnnotationGrid.tsx` with read-only display

**Deliverable**: View showing video + waveform + segment list (no editing yet)

---

### Phase 2: Segmentation (Weeks 3-4)

**Goal**: Implement auto-segmentation and manual boundary editing

**Tasks**:
1. Port SayMore's auto-segmentation algorithm to TypeScript
2. Use Web Audio API for waveform analysis
3. Run algorithm in Web Worker
4. Add WaveSurfer regions for segment boundaries
5. Implement drag-to-adjust boundary
6. Add manual add/delete/split/merge buttons

**Deliverable**: Working segmentation tools with visual feedback

---

### Phase 3: Text Annotation (Weeks 5-6)

**Goal**: Enable text entry and keyboard-driven workflow

**Tasks**:
1. Make `AnnotationGrid` editable
2. Implement keyboard navigation (Tab, Enter, F2)
3. Add auto-loop playback on segment focus
4. Implement save to ELAN (.eaf) format
5. Add load from existing ELAN files

**Deliverable**: Full transcription workflow (video visible throughout)

---

### Phase 4: Multi-Layer Playback (Weeks 7-8)

**Goal**: Add WaveSurfer tracks for oral annotations

**Tasks**:
1. Add WaveSurfer tracks 1 and 2 for careful/translation
2. Implement volume sliders with kings/princes categorization
3. Synchronize playback across all tracks + video
4. Implement speed-adjusted playback for princes

**Deliverable**: Multi-track playback matching Prestige functionality

---

### Phase 5: Oral Annotation Recording (Weeks 9-10)

**Goal**: Enable recording of careful speech and oral translations

**Tasks**:
1. Create `RecordingDialog.tsx` component
2. Use Web Audio API MediaRecorder for recording
3. Save recordings to `_Annotations` folder
4. Generate merged audio files for tracks 1-2
5. Update ELAN file with audio references

**Deliverable**: In-app recording capability

---

### Phase 6: Video Export (Weeks 11-12)

**Goal**: Port Prestige's FFmpeg export functionality

**Tasks**:
1. Port `ExportVid.ts` export algorithm from Prestige
2. Create `ExportDialog.tsx` with settings UI
3. Implement FFmpeg clip concatenation in Electron main process
4. Add subtitle burning using FFmpeg ASS filter
5. Implement progress reporting

**Deliverable**: Working video/audio export with multi-layer mixing

---

### Phase 7: Polish & Testing (Weeks 13-14)

**Goal**: Refinement and user testing

**Tasks**:
1. Performance optimization (WaveSurfer rendering, large files)
2. Error handling and validation
3. User documentation
4. Accessibility (keyboard shortcuts, screen readers)
5. User testing with language documenters
6. Bug fixes

**Deliverable**: Production-ready transcription tools

---

## Dependencies

### Existing (Already in Lameta)
- `react-player` (v2.9.0) - Video playback ✓
- `fluent-ffmpeg` (v2.1.3) - FFmpeg wrapper ✓
- `ffmpeg-static-electron` - Bundled FFmpeg ✓
- `ffprobe-static-electron` - Bundled FFprobe ✓
- `electron` - Desktop app framework ✓
- `mobx` - State management ✓

### New Dependencies to Add
- `wavesurfer.js` (v7.x) - Waveform visualization and playback
  - Already used by Prestige, modern API
  - Plugins: RegionsPlugin for segment boundaries
- `@devexpress/dx-react-grid` (v4.0.x) - Editable data grid
  - Used by Prestige for annotation table
  - Good keyboard navigation support
- `react-hot-toast` (v2.6.x) - Toast notifications
  - Used by Prestige for export status
- `xml2js` (v0.6.x) - XML parsing for ELAN files
  - Used by Prestige for .eaf parsing

### Optional Enhancements
- `recordrtc` - Simplified recording API (alternative to raw MediaRecorder)
- `@testing-library/react` - Component testing
- `vitest` - Fast test runner (if migrating from Jest)

---

## Open Questions & Design Decisions

### 1. ELAN Compatibility vs. SayMore Format

**Question**: Should we support both ELAN (.eaf) and SayMore (.wav.annotations.eaf) formats, or standardize on ELAN?

**Recommendation**:
- **Primary format**: ELAN (.eaf) - widely used, excellent tool ecosystem
- **Read compatibility**: Support reading SayMore format for migration
- **Write**: Only write ELAN format for simplicity

**Rationale**: ELAN is the de facto standard for language documentation annotation. By focusing on ELAN, we ensure maximum interoperability.

---

### 2. Oral Annotation Storage

**Question**: Should oral annotations be stored as:
- A) Individual files per segment (`segment_001_careful.mp3`, etc.)
- B) Merged files per track (`Careful_Merged.mp3` with timecode fragments)
- C) Both?

**Recommendation**: **Option C (Both)**

**Implementation**:
- Record to individual files first (easier editing, re-recording)
- Generate merged files on demand for playback performance
- Store both in `_Annotations` folder
- ELAN file references individual files with `#t=start,end` fragments
- WaveSurfer loads merged files for performance

**Rationale**:
- Individual files: Easy to re-record single segments, edit in Audacity
- Merged files: Better playback performance (no file switching), required for export

---

### 3. Auto-Segmentation Accuracy

**Question**: SayMore's auto-segmenter works well but isn't perfect. How should we handle imperfect results?

**Recommendation**:
- Always show results as preview first (on waveform with highlighted regions)
- Provide "Accept", "Adjust Settings & Re-run", and "Cancel" buttons
- Make manual adjustment very easy (drag boundaries, visual feedback)
- Store auto-segmentation settings per project (user can refine over time)

**UI Mockup**:
```
┌──────────────────────────────────────────────┐
│  Auto-Segmentation Results                   │
├──────────────────────────────────────────────┤
│  Found 42 segments                           │
│  Average length: 5.8 seconds                 │
│  Range: 1.2s - 9.8s                          │
│                                              │
│  [Waveform with preview regions]             │
│                                              │
│  Settings:                                   │
│    Min length: [2s  ]  Max length: [10s ]    │
│    Pause sensitivity: [─────●───] Medium     │
│                                              │
│  [Cancel] [Adjust & Re-run] [Accept]         │
└──────────────────────────────────────────────┘
```

---

### 4. Performance for Long Sessions

**Question**: How to handle performance with:
- Long videos (>1 hour)
- Many segments (>500)
- Large waveform files

**Recommendation**:
- **Waveform rendering**: Use WaveSurfer's built-in peak caching
- **Grid virtualization**: Render only visible rows (use `react-window` or DevExpress built-in virtualization)
- **Video**: Use react-player's light mode (poster frame until play)
- **Lazy load oral annotations**: Only load audio files for visible segments
- **Auto-save**: Save to ELAN file incrementally (debounced, every 30 seconds)

---

### 5. Multi-User Collaboration

**Question**: Should we support multiple users transcribing different segments of the same session?

**Recommendation**: **Phase 2 feature** (not in initial implementation)

**Future Design**:
- Lock segments when being edited
- Use Git-based merging for .eaf files (text-based format)
- Show "Transcribed by X on DATE" metadata per segment
- Conflict resolution UI for overlapping edits

---

## Success Metrics

### User Experience
- [ ] Video remains visible during all transcription work (no modal dialogs blocking video)
- [ ] Keyboard shortcuts work consistently (F2, Tab, Enter)
- [ ] Segment boundary adjustment feels responsive (<100ms visual feedback)
- [ ] Auto-segmentation achieves >80% accuracy on typical recordings (minimal manual adjustment needed)

### Performance
- [ ] Page load time <3 seconds for typical session (30min video, 100 segments)
- [ ] Waveform rendering <1 second for 30min audio file
- [ ] Video export processes at >1x speed (30min video exports in <30min)
- [ ] UI remains responsive during background operations (export, auto-segment)

### Compatibility
- [ ] Load existing ELAN .eaf files created in ELAN tool
- [ ] Export ELAN .eaf files that open correctly in ELAN
- [ ] Export video plays in VLC, QuickTime, and web browsers
- [ ] SRT subtitles display correctly in video players

### Quality
- [ ] Segment boundaries snap to zero-crossings (no clicks/pops)
- [ ] Audio export matches source quality (no degradation)
- [ ] Subtitle timing matches video (<50ms sync error)
- [ ] Kings/princes mixing produces clear, balanced audio

---

## Appendix A: Glossary

- **Auto-segmentation**: Automatic detection of natural pauses to divide audio into segments
- **Careful Speech**: Slow, clear re-recording of source language for language learning
- **ELAN**: EUDICO Linguistic Annotator, industry-standard annotation tool
- **Kings/Princes**: Audio mixing strategy where "kings" (primary tracks) control duration and "princes" (background tracks) are adjusted to match
- **Oral Annotation**: Recorded audio annotation (careful speech or oral translation)
- **Region**: Visual marker on waveform showing segment boundaries (WaveSurfer term)
- **Segment**: Time-bounded portion of audio/video with associated transcription/translation
- **Tier**: Layer of annotation in ELAN format (e.g., Transcription tier, Translation tier)
- **Time-aligned**: Synchronized to specific timestamps in media file

---

## Appendix B: References

### Source Code Repositories
- **SayMore**: https://github.com/sillsdev/saymore
  - `/src/SayMore/Transcription/` - Transcription UI and models
  - `/src/SayMore/Transcription/Model/AutoSegmenter.cs` - Segmentation algorithm
  - `/src/SayMore/Transcription/UI/TextAnnotationGrid/` - Grid implementation

- **Prestige**: https://github.com/MattGyverLee/prestige
  - `/src/components/DeeJay/DeeJay.tsx` - Multi-track waveform player
  - `/src/components/Player/Player.tsx` - Video player with subtitles
  - `/src/components/AnnotTable/AnnotTable.tsx` - Annotation grid
  - `/src/components/FolderSelection/ExportVid.tsx` - Video export with FFmpeg

### Documentation
- SayMore Documentation: https://documentation.help/SayMore/
- Prestige Thesis Paper: https://mattgyverlee.github.io/docs/Matthew%20Lee%20Defense%20Copy.pdf
- WaveSurfer.js v7 Docs: https://wavesurfer.xyz/
- ELAN Format Specification: https://www.mpi.nl/tools/elan/EAF-format-specification.pdf

### Research Papers
- Lee, M. (2022). "Prestige: Mobilizing an Orally Annotated Language Documentation Corpus" (ResearchGate)
- Boerger, B. et al. (2019). "BOLD: Basic Oral Language Documentation" - Language documentation methodology

---

## Appendix C: Mockups

### Annotate Tab (SayMore-inspired)

```
┌──────────────────────────────────────────────────────────────────┐
│ Lameta - Session ETR009                                          │
├──────────────────────────────────────────────────────────────────┤
│  File: ETR009.mp4                                                 │
│  ┌──────────────────┐ ┌──────────────────────────────────┐       │
│  │   Annotate       │ │  Preview                         │       │
│  └──────────────────┘ └──────────────────────────────────┘       │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                             │  │
│  │          [Video Player - 16:9 aspect ratio]                │  │
│  │                                                             │  │
│  │                                                             │  │
│  │          Bonjour, comment allez-vous?                       │  │
│  │          (Subtitle overlay - transcription)                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Source Audio                                                     │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ [Waveform with green regions showing segment boundaries]    ││
│  │ [Active segment highlighted, regions draggable]             ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ [Auto-segment] [Add Boundary] [Delete] [Merge] [Split]     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Time   │ Transcription        │ Translation      │ ♪ │ ♪  │  │
│  ├────────┼─────────────────────┼──────────────────┼───┼────┤  │
│  │ 0:00 ▶ │ Bonjour, comment... │ Hello, how...    │ ⏺ │ ⏺  │  │
│  │ 0:05 ▶ │ Je m'appelle...     │ My name is...    │ ⏺ │ ⏺  │  │
│  │ 0:12 ▶ │ Enchanté.           │ Nice to meet you │ ⏺ │ ⏺  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  [⏮] [⏯] [⏭] Speed: [1x▼] Loop: [3x▼]                           │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Preview Tab (Prestige-inspired)

```
┌──────────────────────────────────────────────────────────────────┐
│ Lameta - Session ETR009                                          │
├──────────────────────────────────────────────────────────────────┤
│  File: ETR009.mp4                                                 │
│  ┌──────────────────┐ ┌──────────────────────────────────┐       │
│  │   Annotate       │ │  Preview                         │       │
│  └──────────────────┘ └──────────────────────────────────┘       │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                             │  │
│  │          [Video Player - 16:9 aspect ratio]                │  │
│  │                                                             │  │
│  │                                                             │  │
│  │          Bonjour, comment allez-vous?                       │  │
│  │          (Subtitle overlay - showing selected track)        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Source Audio        Volume: ═════════●═ 90%    [ ] Mute         │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ [Waveform with playback position indicator]                 ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                   │
│  Careful Speech      Volume: ════●══════ 30%    [ ] Mute         │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ [Waveform showing merged oral transcription clips]          ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                   │
│  Oral Translation    Volume: ════════════  0%    [✓] Mute         │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ [Empty - no recordings yet]                                  ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                   │
│  Kings: Source Audio (90%)                                        │
│  Princes: Careful Speech (30%)                                    │
│  Silent: Oral Translation (muted)                                 │
│                                                                   │
│  [⏮] [⏯] [⏭] Speed: [1x▼]  │  [Export Video ▼]                  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Export Dialog (Lameta-styled)

```
┌─────────────────────────────────────────┐
│         Export Video                    │
├─────────────────────────────────────────┤
│                                         │
│ Format:       [MP4             ▼]       │
│ Quality:      [High (1080p)    ▼]       │
│                                         │
│ Audio Mix (based on current volumes):  │
│   ☑ Source audio at 90% (King)         │
│   ☑ Careful speech at 30% (Prince)     │
│   ☐ Oral translation (muted)           │
│                                         │
│ Subtitles:                              │
│   ◉ Burn transcription into video      │
│   ○ Burn translation into video        │
│   ○ Separate SRT file only             │
│   ○ No subtitles                       │
│                                         │
│ Playback Speed: [1x ▼]                 │
│                                         │
│ Output folder:                          │
│ [C:\Users\...\ETR009]  [Browse...]     │
│                                         │
│   [Cancel]              [Export]        │
└─────────────────────────────────────────┘
```

---

## Conclusion

This specification combines the best features of SayMore's transcription workflow with Prestige's video-centric multi-layer architecture, using a **two-tab interface** that separates annotation work from preview/export. This design addresses SayMore's key limitation (video separation) while maintaining its excellent keyboard-driven efficiency.

### Key Features

**Annotate Tab (Work Mode):**
- SayMore-inspired entry point and workflow
- Video visible with single source waveform
- Focus on transcription and text entry
- Clean, distraction-free interface
- Keyboard shortcuts for speed (F2, Tab, Enter)

**Preview Tab (Review/Share Mode):**
- Prestige-inspired multi-track playback
- Volume mixing with kings/princes categorization
- Video export with burned-in subtitles
- Professional output for community sharing

### Technical Approach

By implementing these features using:
- **Modern React hooks** (functional components throughout)
- **Lameta's design system** (clean, minimal UI with CSS variables)
- **Existing tech stack** (react-player, react-tabs, ffmpeg, electron)
- **Standard HTML elements** (no heavy UI libraries)

We create a powerful language documentation tool that:

1. **Keeps video visible** during all transcription work (ELAN-like interface)
2. **Provides efficient keyboard workflow** (SayMore's Tab/Enter/F2 shortcuts)
3. **Separates work from preview** (focused annotation vs. multi-layer playback)
4. **Uses Lameta's clean design** (familiar, consistent with existing UI)
5. **Enables multi-layer playback** (Prestige's WaveSurfer + kings/princes mixing)
6. **Exports high-quality videos** (Prestige's FFmpeg export with subtitle burning)
7. **Integrates with ELAN ecosystem** (read/write .eaf format)

The phased implementation plan allows for incremental development and user feedback, with each phase delivering tangible value. The two-tab design provides flexibility for different user workflows while maintaining a cohesive, Lameta-native experience.

---

**End of Specification**
