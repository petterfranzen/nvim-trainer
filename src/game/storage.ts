const KEY = 'nvim-trainer:progress';

interface Progress {
  /** Highest level index (0-based) the player has unlocked/reached. */
  highestUnlocked: number;
  /** Level indices completed at least once. */
  completed: number[];
}

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { highestUnlocked: 0, completed: [] };
    const parsed = JSON.parse(raw);
    return {
      highestUnlocked: typeof parsed.highestUnlocked === 'number' ? parsed.highestUnlocked : 0,
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
    };
  } catch {
    return { highestUnlocked: 0, completed: [] };
  }
}

function save(progress: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // localStorage unavailable (private mode, etc.) - progress just won't persist.
  }
}

export function getProgress(): Progress {
  return load();
}

export function markCompleted(levelIndex: number, totalLevels: number) {
  const progress = load();
  if (!progress.completed.includes(levelIndex)) progress.completed.push(levelIndex);
  progress.highestUnlocked = Math.min(Math.max(progress.highestUnlocked, levelIndex + 1), totalLevels - 1);
  save(progress);
}

export function resetProgress() {
  save({ highestUnlocked: 0, completed: [] });
}
