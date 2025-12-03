/**
 * VideoPlayerSection - Shared video player component
 * Wraps ReactPlayer for video/audio playback
 */

import React, { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import ReactPlayer from "react-player";
import { VideoPlayerSectionProps } from "./types";
import "./VideoPlayerSection.css";

/**
 * Imperative handle for VideoPlayerSection
 */
export interface VideoPlayerSectionHandle {
  seekTo: (time: number, type?: "seconds" | "fraction") => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

/**
 * VideoPlayerSection Component
 *
 * Wraps ReactPlayer to provide video/audio playback with:
 * - Controlled playback state
 * - Progress reporting
 * - Duration detection
 * - Playback rate control
 */
export const VideoPlayerSection = forwardRef<VideoPlayerSectionHandle, VideoPlayerSectionProps>(({
  url,
  playback,
  onProgress,
  onDuration,
  onPlayPause,
  className = "",
}, ref) => {
  const playerRef = useRef<ReactPlayer>(null);

  /**
   * Expose imperative handle for parent component control
   */
  useImperativeHandle(ref, () => ({
    seekTo: (time: number, type: "seconds" | "fraction" = "seconds") => {
      if (playerRef.current) {
        playerRef.current.seekTo(time, type);
      }
    },
    getCurrentTime: () => {
      return playerRef.current ? playerRef.current.getCurrentTime() : 0;
    },
    getDuration: () => {
      return playerRef.current ? playerRef.current.getDuration() : 0;
    },
  }));

  /**
   * Handle progress updates from ReactPlayer
   */
  const handleProgress = (state: { played: number; playedSeconds: number; loaded: number; loadedSeconds: number }) => {
    onProgress(state.playedSeconds);
  };

  /**
   * Handle duration when media is loaded
   */
  const handleDuration = (duration: number) => {
    onDuration(duration);
  };

  /**
   * Handle play event
   */
  const handlePlay = () => {
    if (!playback.playing) {
      onPlayPause(true);
    }
  };

  /**
   * Handle pause event
   */
  const handlePause = () => {
    if (playback.playing) {
      onPlayPause(false);
    }
  };

  /**
   * Seek to specific time when requested
   */
  useEffect(() => {
    if (playerRef.current && playback.currentTime !== undefined) {
      // Only seek if there's a significant difference to avoid feedback loop
      const currentPlayerTime = playerRef.current.getCurrentTime();
      const timeDiff = Math.abs(currentPlayerTime - playback.currentTime);

      // Seek if difference is more than 0.5 seconds
      if (timeDiff > 0.5) {
        playerRef.current.seekTo(playback.currentTime, "seconds");
      }
    }
  }, [playback.currentTime]);

  /**
   * Handle loop region if set
   */
  useEffect(() => {
    if (playback.loop && playback.loopRegion && playerRef.current) {
      const currentTime = playerRef.current.getCurrentTime();

      // If we've passed the loop end, seek back to start
      if (currentTime >= playback.loopRegion.end) {
        playerRef.current.seekTo(playback.loopRegion.start, "seconds");
      }
    }
  }, [playback.currentTime, playback.loop, playback.loopRegion]);

  return (
    <div className={`video-player-section ${className}`}>
      <div className="player-wrapper">
        <ReactPlayer
          ref={playerRef}
          className="react-player"
          url={url}
          playing={playback.playing}
          playbackRate={playback.playbackRate}
          volume={playback.volume}
          muted={playback.muted}
          loop={playback.loop && !playback.loopRegion} // Native loop only if no custom loop region
          width="100%"
          height="100%"
          progressInterval={200}
          onPlay={handlePlay}
          onPause={handlePause}
          onProgress={handleProgress}
          onDuration={handleDuration}
          onEnded={() => {
            // If loop region is set, seek to start
            if (playback.loop && playback.loopRegion && playerRef.current) {
              playerRef.current.seekTo(playback.loopRegion.start, "seconds");
            }
          }}
          onError={(e) => {
            console.error("ReactPlayer error:", e);
          }}
          onBuffer={() => {
            console.log("ReactPlayer buffering...");
          }}
          onReady={() => {
            console.log("ReactPlayer ready");
          }}
          config={{
            file: {
              attributes: {
                controlsList: "nodownload", // Prevent download button
              },
            },
          }}
        />
      </div>
    </div>
  );
});

VideoPlayerSection.displayName = "VideoPlayerSection";

export default VideoPlayerSection;
