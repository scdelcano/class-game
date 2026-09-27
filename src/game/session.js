import { createEmitter } from '../core/emitter.js';
import { showToast } from '../ui/toast.js';

/**
 * The school day: free play <-> class time.
 *
 *   'free'      before class / recess: students wander
 *   'starting'  the bell rang, students are walking to their desks
 *   'class'     everyone is seated (attendance and later lessons happen here)
 *
 * Started/ended by the desk bell, the bell button, or voice.
 * Events: 'state' (new state)
 */
export function createSession({ classroom, students }) {
  const events = createEmitter();
  let state = 'free';

  function set(next) {
    state = next;
    events.emit('state', state);
  }

  function startClass({ ring = true } = {}) {
    if (state !== 'free') {
      showToast("We're already in class!", { icon: '📚' });
      return false;
    }
    if (ring) classroom.ringBell();
    set('starting');
    showToast('Class is starting!', { icon: '🔔' });
    students.goToSeats(() => set('class'));
    return true;
  }

  function endClass({ ring = true } = {}) {
    if (state === 'free') {
      showToast("It's already playtime!", { icon: '🎈' });
      return false;
    }
    if (ring) classroom.ringBell();
    set('free');
    showToast('Class dismissed!', { icon: '🎈' });
    students.dismiss();
    return true;
  }

  function quiet() {
    students.quiet();
    showToast('Shhh… quiet voices.', { icon: '🤫' });
  }

  // tapping the bell on the desk (it has already rung) switches between the two
  classroom.on('bell', () => (state === 'free' ? startClass({ ring: false }) : endClass({ ring: false })));

  return {
    on: events.on,
    get state() {
      return state;
    },
    startClass,
    endClass,
    quiet,
    toggleClass() {
      return state === 'free' ? startClass() : endClass();
    },
  };
}
