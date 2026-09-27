// "My Classroom" — entry point: finds out who's playing (when more than one
// player uses this tablet), then starts their game (game/app.js).
import './styles/base.css';
import './styles/game.css';
import './styles/ui.css';
import { createProfiles } from './core/profiles.js';
import { pickProfile } from './ui/profile-picker.js';
import { registerServiceWorker } from './pwa.js';

registerServiceWorker();

const profiles = createProfiles();
const chosen = profiles.count > 1 ? pickProfile(profiles) : Promise.resolve(profiles.get(profiles.lastId));

// The 3D game loads while the player picks.
Promise.all([chosen, import('./game/app.js')]).then(([profile, game]) => {
  profiles.setLast(profile.id);
  game.startGame({ profile, profiles });
});
