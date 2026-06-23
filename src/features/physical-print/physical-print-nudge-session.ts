const PHYSICAL_PRINT_NUDGE_STORAGE_PREFIX =
  "physical-print-nudge-dismissed:";
const handledFigureIds = new Set<string>();

function getStorageKey(figureId: string) {
  return `${PHYSICAL_PRINT_NUDGE_STORAGE_PREFIX}${figureId}`;
}

export function wasPhysicalPrintNudgeHandled(figureId: string) {
  if (handledFigureIds.has(figureId)) {
    return true;
  }

  try {
    return window.sessionStorage.getItem(getStorageKey(figureId)) === "1";
  } catch {
    return false;
  }
}

export function markPhysicalPrintNudgeHandled(figureId: string) {
  handledFigureIds.add(figureId);

  try {
    window.sessionStorage.setItem(getStorageKey(figureId), "1");
  } catch {
    // The in-memory set still prevents repeat prompts when storage is blocked.
  }
}
