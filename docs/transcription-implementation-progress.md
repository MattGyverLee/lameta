# Transcription Tools Implementation Progress

**Started:** 2025-11-23
**Status:** Phase 1 - Foundation (In Progress)

---

## Session Summary

### Completed
✅ **Specification document** created and finalized (v1.1)
- Two-tab interface design (Annotate + Preview)
- SayMore-inspired workflow
- Prestige-inspired multi-layer playback
- Lameta design system integration
- 14-week phased implementation plan

✅ **Component directory structure** created
- `/src/components/transcription/`
  - `/AnnotateTab/` - SayMore-inspired transcription interface
  - `/PreviewTab/` - Prestige-inspired playback and export
  - `/shared/` - Shared components (VideoPlayer, PlaybackControls)

✅ **Dependencies**
- WaveSurfer.js ^7.8.0 added to package.json
- xml2js already present (for ELAN file parsing)
- react-tabs, react-player, fluent-ffmpeg already present

✅ **TypeScript type definitions** (`shared/types.ts`)
- AnnotationSegment, TranscriptionState interfaces
- PlaybackState, AudioTrack interfaces
- SegmentationSettings, ExportSettings interfaces
- KingsPrincesConfig for multi-track logic
- Component props interfaces

✅ **TranscriptionView main component** (`TranscriptionView.tsx`)
- Two-tab layout using react-tabs
- State management with React hooks
- Auto-save logic (30-second debounce)
- Mock segment data for testing
- Event handlers for segments, playback, updates

✅ **AnnotateTab component** (`AnnotateTab/AnnotateTab.tsx`)
- Video player section placeholder
- Segmentation toolbar (auto-segment, add, delete, split, merge)
- Waveform section placeholder
- Editable annotation grid (transcription + translation fields)
- Playback controls

✅ **PreviewTab component** (`PreviewTab/PreviewTab.tsx`)
- Video player section placeholder
- Multi-track waveform placeholders (3 tracks)
- Volume controls with sliders
- Kings/Princes categorization (84% threshold)
- Export button placeholder
- Playback controls

✅ **CSS styling** with Lameta design system
- TranscriptionView.css: Main container and tab styling
- AnnotateTab.css: Grid, toolbar, waveform placeholders
- PreviewTab.css: Multi-track layout, volume sliders

### In Progress
🔄 **Next immediate tasks**
- Install WaveSurfer.js dependency (npm registry was down, retry needed)
- Create VideoPlayerSection shared component with ReactPlayer
- Add entry point in FolderPane for media files

### Next Steps

#### Immediate (Phase 1 - Foundation)
1. **Complete WaveSurfer.js installation**
2. **Create main TranscriptionView component**
   - Two-tab layout using react-tabs
   - Tab switching logic
   - Basic routing/state management

3. **Create AnnotateTab scaffold**
   - VideoPlayer section
   - Single waveform section (placeholder)
   - Annotation grid (read-only)
   - Playback controls

4. **Create shared components**
   - VideoPlayerSection.tsx (wraps ReactPlayer)
   - PlaybackControls.tsx (transport controls, speed, loop)

5. **Implement basic data model**
   - AnnotationSegment interface
   - TranscriptionState interface
   - useTranscriptionState hook

6. **Add entry point in FolderPane**
   - Detect media files (.mp4, .wav, .eaf)
   - "Annotate" button for media files
   - Open TranscriptionView component

#### Phase 1 Deliverable Goal
A working UI showing:
- Video playback
- Waveform visualization (basic)
- List of segments (read-only grid)
- Tab switching between Annotate and Preview

---

## Architecture Overview

### Component Structure (To Be Built)

```
src/components/transcription/
├── TranscriptionView.tsx          # Main container with tabs
├── TranscriptionView.css          # Lameta-styled CSS
│
├── AnnotateTab/
│   ├── AnnotateTab.tsx            # Annotate tab panel
│   ├── WaveformSection.tsx        # Waveform with regions
│   ├── SegmentationToolbar.tsx    # Auto-segment, manual tools
│   ├── AnnotationGrid.tsx         # Editable grid
│   └── AnnotateTab.css
│
├── PreviewTab/
│   ├── PreviewTab.tsx             # Preview tab panel
│   ├── MultiTrackWaveform.tsx     # 3 waveform tracks
│   ├── VolumeControls.tsx         # Volume sliders per track
│   ├── ExportDialog.tsx           # Export settings
│   └── PreviewTab.css
│
└── shared/
    ├── VideoPlayerSection.tsx     # ReactPlayer wrapper
    ├── PlaybackControls.tsx       # Transport controls
    ├── useTranscriptionState.ts   # State management hook
    ├── useWaveSurfer.ts           # WaveSurfer integration hook
    └── types.ts                   # TypeScript interfaces
```

### Data Flow

```
FolderPane.tsx
    ↓ (user clicks media file)
    ↓ (detects .mp4/.wav or has .eaf annotation)
    ↓
TranscriptionView.tsx
    ↓
useTranscriptionState() hook
    ├── Load ELAN file (if exists)
    ├── Create segment array
    ├── Initialize playback state
    └── Provide actions (play, segment, edit)
    ↓
Tab 1: AnnotateTab          Tab 2: PreviewTab
├── VideoPlayer             ├── VideoPlayer
├── Waveform (source)       ├── Waveform (source)
├── Segmentation tools      ├── Waveform (careful)
├── Annotation grid         ├── Waveform (translation)
└── Playback controls       ├── Volume controls
                            └── Export button
```

---

## Dependencies Status

### Existing (Already in Lameta)
- ✅ `react-player` - Video playback
- ✅ `react-tabs` - Tab interface
- ✅ `fluent-ffmpeg` - FFmpeg wrapper
- ✅ `mobx` - State management
- ✅ `electron` - Desktop framework

### To Be Added
- 🔄 `wavesurfer.js` (v7.x) - Waveform visualization (installing)
- ⏳ `xml2js` - ELAN file parsing (not yet installed)
- ⏳ (Optional) DevExpress grid for annotation table (to be evaluated)

---

## Implementation Checklist

### Phase 1: Foundation (Weeks 1-2) - CURRENT PHASE

#### Week 1: Basic UI Structure
- [x] Install WaveSurfer.js (added to package.json, pending npm install)
- [x] Create TranscriptionView.tsx with two-tab layout
- [x] Create AnnotateTab.tsx scaffold
- [x] Create PreviewTab.tsx scaffold
- [ ] Create VideoPlayerSection.tsx (shared) - NEXT
- [ ] Create PlaybackControls.tsx (shared)
- [x] Add TranscriptionView.css with Lameta design system
- [ ] Add entry point in FolderPane.tsx for media files

#### Week 2: Data Model & Basic Functionality
- [x] Create types.ts with AnnotationSegment interface (COMPLETED)
- [ ] Create useTranscriptionState.ts hook
- [ ] Create useWaveSurfer.ts hook
- [ ] Implement basic segment data (hardcoded for testing)
- [ ] Create AnnotationGrid.tsx (read-only)
- [ ] Wire up video playback
- [ ] Wire up waveform rendering (WaveSurfer.js)
- [ ] Test basic tab switching and playback

**Deliverable:** Working UI showing video + waveform + segment list

---

### Phase 2: Segmentation (Weeks 3-4)

- [ ] Port SayMore auto-segmentation algorithm to TypeScript
- [ ] Implement Web Audio API waveform analysis
- [ ] Create Web Worker for non-blocking segmentation
- [ ] Add WaveSurfer regions for segment boundaries
- [ ] Implement drag-to-adjust boundaries
- [ ] Add manual segment tools (add, delete, split, merge)
- [ ] Add segmentation settings dialog

**Deliverable:** Working segmentation tools with visual feedback

---

### Phase 3: Text Annotation (Weeks 5-6)

- [ ] Make AnnotationGrid editable
- [ ] Implement keyboard navigation (Tab, Enter, F2)
- [ ] Add auto-loop playback on segment focus
- [ ] Install xml2js for ELAN file parsing
- [ ] Implement ELAN .eaf file reader
- [ ] Implement ELAN .eaf file writer
- [ ] Add auto-save functionality

**Deliverable:** Full transcription workflow

---

### Phase 4: Multi-Layer Playback (Weeks 7-8)

- [ ] Create MultiTrackWaveform.tsx component
- [ ] Add WaveSurfer instance for each track (3 total)
- [ ] Implement volume sliders with kings/princes logic
- [ ] Synchronize playback across all tracks
- [ ] Implement speed-adjusted playback for princes
- [ ] Add mute checkboxes per track

**Deliverable:** Multi-track playback in Preview tab

---

### Phase 5: Oral Annotation Recording (Weeks 9-10)

- [ ] Create RecordingDialog.tsx component
- [ ] Implement MediaRecorder API integration
- [ ] Save recordings to _Annotations folder
- [ ] Generate merged audio files for tracks
- [ ] Update ELAN file with audio references
- [ ] Add recording buttons to AnnotationGrid cells

**Deliverable:** In-app recording capability

---

### Phase 6: Video Export (Weeks 11-12)

- [ ] Port ExportVid algorithm from Prestige
- [ ] Create ExportDialog.tsx with settings UI
- [ ] Implement FFmpeg clip concatenation (Electron main process)
- [ ] Add subtitle burning using FFmpeg ASS filter
- [ ] Implement progress reporting
- [ ] Add audio-only export option

**Deliverable:** Working video/audio export

---

### Phase 7: Polish & Testing (Weeks 13-14)

- [ ] Performance optimization (WaveSurfer rendering, large files)
- [ ] Error handling and validation
- [ ] User documentation
- [ ] Accessibility (keyboard shortcuts, screen readers)
- [ ] User testing with language documenters
- [ ] Bug fixes

**Deliverable:** Production-ready transcription tools

---

## Design System Integration

### CSS Variables to Use
```css
--session--color: #cff09f;           /* Segment regions */
--accent-color: #e69664;             /* Buttons, highlights */
--link--color: #216ba5;              /* Links */
--error-color: #dc322f;              /* Errors */
--pane__border--color: #abadb3;      /* Borders */
```

### Component Styling Guidelines
- Use standard HTML elements (no Material-UI for transcription UI)
- Native `<button>` with Lameta classes
- Native `<input type="range">` for volume sliders
- Native `<input type="checkbox">` for mute toggles
- CSS modules for component-specific styles

---

## Technical Notes

### WaveSurfer.js Integration
- Use v7.x API (modern, hook-friendly)
- Create one instance per waveform
- Use RegionsPlugin for segment boundaries
- Implement useWaveSurfer custom hook for lifecycle management

### State Management
- Use React hooks + MobX for state
- useTranscriptionState hook manages segments, playback, volumes
- Auto-save to ELAN file every 30 seconds (debounced)

### File Format
- Primary: ELAN .eaf format (XML-based, widely compatible)
- Read compatibility: SayMore format (for migration)
- Store oral annotations as individual files + merged files

### Performance Considerations
- Use react-window for virtualizing large segment grids (>100 segments)
- WaveSurfer peak caching for fast waveform rendering
- Lazy load oral annotation audio files (only visible segments)

---

## Next Session Goals

1. **Complete WaveSurfer.js installation**
2. **Create basic TranscriptionView component structure**
3. **Create shared VideoPlayerSection component**
4. **Implement simple useTranscriptionState hook with mock data**
5. **Add entry point in FolderPane to open transcription view**
6. **Test basic video playback + tab switching**

**Target:** Get something visible on screen that demonstrates the two-tab architecture

---

## Resources

- **Specification:** `/docs/transcription-tools-spec.md`
- **SayMore Repository:** https://github.com/sillsdev/saymore
- **Prestige Repository:** https://github.com/MattGyverLee/prestige
- **WaveSurfer.js Docs:** https://wavesurfer.xyz/
- **ELAN Format Spec:** https://www.mpi.nl/tools/elan/EAF-format-specification.pdf
