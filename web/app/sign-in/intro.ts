// The sign-in intro: on a device's first visit the logo and product name start
// large in the middle of the stage, then settle into their place while the rest
// of the brand panel fades up. The form is usable from the first frame.

export const introSeenKey = 'colearner-sign-in-intro'

/** Set on <html> before first paint so the lockup is hidden until the intro starts. */
export const introAttribute = 'data-intro'

interface IntroStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

/**
 * Whether this visit plays the intro. Reading also records the visit, so the
 * intro plays once per device even if it is cut short. Reduced motion never
 * plays it; storage that throws (private mode, blocked site data) never does either.
 */
export function claimIntro(storage: IntroStorage | undefined, reducedMotion: boolean): boolean {
  try {
    if (!storage || storage.getItem(introSeenKey)) return false
    storage.setItem(introSeenKey, '1')
    return !reducedMotion
  }
  catch {
    return false
  }
}

/**
 * Inline head script for the server-rendered first load: marks <html> before
 * paint. It only reads; claimIntro records the visit once the page runs.
 */
export const introHeadScript = `try{if(!localStorage.getItem('${introSeenKey}')&&!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.setAttribute('${introAttribute}','')}catch(e){}`

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

export interface IntroStart {
  x: number
  y: number
  scale: number
}

/**
 * Where the lockup starts, as a transform from its resting box: centred on
 * `focus` and as large as `maxScale` allows while keeping `margin` clear of
 * the stage's sides.
 */
export function introStart(lockup: Box, stage: Box, focus: { x: number, y: number }, maxScale: number, margin = 24): IntroStart {
  const room = Math.max(stage.width - margin * 2, lockup.width)
  const scale = Math.max(1, Math.min(maxScale, room / lockup.width))
  return {
    x: focus.x - (lockup.left + lockup.width / 2),
    y: focus.y - (lockup.top + lockup.height / 2),
    scale,
  }
}
