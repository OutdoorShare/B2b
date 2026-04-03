import { useState, useEffect } from "react";

export function useVideoPlayer({ durations }: { durations: Record<string, number> }) {
  const [currentScene, setCurrentScene] = useState(0);
  const sceneKeys = Object.keys(durations);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    function nextScene() {
      setCurrentScene((prev) => {
        const next = prev + 1;
        if (next >= sceneKeys.length) {
          return 0; // Loop back to start
        }
        return next;
      });
    }

    const duration = durations[sceneKeys[currentScene]];
    if (duration) {
      timeout = setTimeout(nextScene, duration);
    }

    return () => clearTimeout(timeout);
  }, [currentScene, durations, sceneKeys]);

  return { currentScene };
}
