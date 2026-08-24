"use client"

import { useState } from "react"

/**
 * Closes a dialog once a useActionState result turns out successful — without the
 * "setState in an effect" cascading-render pattern React (and eslint-plugin-react-hooks)
 * flags. This is React's own "adjusting state during render" pattern (comparing against
 * a value stored from the previous render, via useState — not useRef, which the stricter
 * react-hooks/refs rule disallows touching during render): useActionState returns a new
 * `state` object identity on every action resolution, so comparing identity (not value)
 * correctly re-fires even when two consecutive successful submissions carry the same
 * field values.
 */
export function useCloseOnSuccess(state: unknown, success: boolean, close: () => void) {
  const [lastState, setLastState] = useState(state)
  if (lastState !== state) {
    setLastState(state)
    if (success) close()
  }
}
