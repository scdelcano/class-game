import { sfx } from '../audio/sfx.js';
import { holdToOpen } from './grownups.js';

const STATE_LABEL = {
  free: { pill: '🎈 Playtime', bell: 'Start class' },
  starting: { pill: '🚶 Going to seats…', bell: 'End class' },
  class: { pill: '📚 Class time', bell: 'End class' },
};

/**
 * On-screen buttons over the 3D room. The microphone dock is added by
 * ui/mic-button.js.
 */
export function createHud({ onResetView, onMyClass, onBell, onAttendance, onLesson, onGrownups, onSwitch }) {
  const hud = document.getElementById('hud');
  const button = (id, action) => document.getElementById(id).addEventListener('click', () => {
    sfx.unlock();
    action();
  });
  button('reset-view', () => { sfx.pop(); onResetView(); });
  button('my-class', () => { sfx.pop(); onMyClass(); });
  button('bell-button', onBell);
  button('attendance-button', () => { sfx.pop(); onAttendance(); });
  button('lesson-button', () => { sfx.pop(); onLesson(); });
  holdToOpen(document.getElementById('grownups-button'), onGrownups);
  button('switch-button', () => { sfx.pop(); onSwitch(); });

  const pill = document.getElementById('class-state');
  const bellLabel = document.getElementById('bell-label');

  return {
    el: hud,
    set visible(on) {
      hud.hidden = !on;
    },
    /** Make room for a side panel (clipboard or lesson) on the right. */
    set panelOpen(on) {
      document.body.classList.toggle('clipboard-open', on);
    },
    /** Who's teaching; the switch button only shows when there's someone to switch to. */
    setTeacher(profile, canSwitch) {
      const el = document.getElementById('switch-button');
      el.hidden = !canSwitch;
      el.title = `${profile.name} is teaching. Tap to switch.`;
      document.getElementById('switch-emoji').textContent = profile.emoji;
      document.getElementById('switch-label').textContent = profile.name;
    },
    /** 'free' | 'starting' | 'class' */
    setClassState(state) {
      pill.textContent = STATE_LABEL[state].pill;
      pill.dataset.state = state;
      bellLabel.textContent = STATE_LABEL[state].bell;
    },
  };
}
