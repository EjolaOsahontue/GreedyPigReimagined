import { useGreedyPigContext } from "src/context/useGreedyPigContext";

const VOLUME = 0.5; // 0 is silent, 1 is full volume
const cache = new Map(); 

function getPlayer(src) {
  if (!cache.has(src)) {
    const audio = new Audio(src);
    audio.volume = VOLUME;
    cache.set(src, {
      play() {
        // incase browser decides not to play the audio.
        audio.play().catch(() => {});
      },
    });
  }
  return cache.get(src);
}

export default function useAudio(src) {
  const { hasSound } = useGreedyPigContext();
  if (!hasSound) return undefined; 

  return getPlayer(src);
}