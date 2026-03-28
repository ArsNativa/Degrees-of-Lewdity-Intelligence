export type SessionLifecyclePhase = 'inactive' | 'active' | 'cooldown';

export interface SessionLifecycleState {
  phase: SessionLifecyclePhase;
}

export interface SessionLifecycleInput {
  sessionActive: boolean;
}

export interface SessionLifecycleTransition {
  state: SessionLifecycleState;
  phase: SessionLifecyclePhase;
  shouldStartSession: boolean;
  shouldCleanupSession: boolean;
  sessionEnded: boolean;
  retainsSessionData: boolean;
}

export function createSessionLifecycleState(): SessionLifecycleState {
  return { phase: 'inactive' };
}

export function advanceSessionLifecycle(
  state: SessionLifecycleState,
  input: SessionLifecycleInput,
): SessionLifecycleTransition {
  if (input.sessionActive) {
    return {
      state: { phase: 'active' },
      phase: 'active',
      shouldStartSession: state.phase !== 'active',
      shouldCleanupSession: false,
      sessionEnded: false,
      retainsSessionData: true,
    };
  }

  if (state.phase === 'active') {
    return {
      state: { phase: 'cooldown' },
      phase: 'cooldown',
      shouldStartSession: false,
      shouldCleanupSession: false,
      sessionEnded: true,
      retainsSessionData: true,
    };
  }

  if (state.phase === 'cooldown') {
    return {
      state: { phase: 'inactive' },
      phase: 'inactive',
      shouldStartSession: false,
      shouldCleanupSession: true,
      sessionEnded: false,
      retainsSessionData: false,
    };
  }

  return {
    state: { phase: 'inactive' },
    phase: 'inactive',
    shouldStartSession: false,
    shouldCleanupSession: false,
    sessionEnded: false,
    retainsSessionData: false,
  };
}
