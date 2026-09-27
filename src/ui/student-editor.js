import * as THREE from 'three';
import { h, uiRoot } from './dom.js';
import { createKeyboard } from './keyboard.js';
import { confirmDialog } from './dialog.js';
import { showToast } from './toast.js';
import { sfx } from '../audio/sfx.js';
import { Character } from '../characters/character.js';
import { toon } from '../world/materials.js';
import {
  TYPES, SKIN_TONES, HAIR_STYLES, HAIR_COLORS, CLOTHES_COLORS, ANIMALS, PLUSH_COLORS,
  VEHICLE_COLORS, TONES, PRONOUNS, DEFAULT_LOOKS, randomLook,
} from '../characters/options.js';
import { newStudent, MAX_NAME_LENGTH } from '../students/student.js';
import { HELLO_LINES, pickLine } from '../students/lines.js';
import { speakAs, speechSeconds, voiceVariantCount } from '../voice/student-voice.js';

const TABS = [
  { id: 'type', icon: '⭐', label: 'Who' },
  { id: 'look', icon: '🎨', label: 'Look' },
  { id: 'name', icon: '✏️', label: 'Name' },
  { id: 'voice', icon: '🔊', label: 'Voice' },
];

/**
 * "Make a student": a live 3D preview on the left (drawn by the game
 * renderer through a see-through hole in this screen) and big picture
 * buttons on the right, in four tabs: Who / Look / Name / Voice.
 */
export function createStudentEditor({ view, roster, portraits, onClose }) {
  // ---------------------------------------------------------------- 3D preview
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff8ea', '#f1d6b4', 1.7));
  const key = new THREE.DirectionalLight('#fff0d2', 1.8);
  key.position.set(-3, 6, 5);
  scene.add(key);
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.05, 0.14, 40),
    toon('#ffe3a3'),
  );
  pedestal.position.y = -0.07;
  scene.add(pedestal);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

  let character = null;
  let angle = 0.35;
  let spin = 0; // leftover spin from a drag
  let draft = null;
  let original = '';
  let isNew = false;
  let tab = 'type';
  const looksByType = {}; // remember each type's look while switching types

  // ---------------------------------------------------------------- DOM
  const stageName = h('div', { class: 'stage-name' });
  const stage = h('div', { class: 'editor-stage' },
    stageName,
    h('p', { class: 'stage-hint' }, 'Drag to turn · Tap to say hi'),
    h('button', { class: 'big-button', type: 'button', onclick: sayHello }, h('span', { 'aria-hidden': 'true' }, '🔊'), ' Hear me'),
  );
  const tabBar = h('nav', { class: 'tabs' });
  const body = h('div', { class: 'tab-body' });
  const removeButton = h('button', { class: 'big-button danger', type: 'button', onclick: removeStudent }, h('span', { 'aria-hidden': 'true' }, '🗑️'), ' Remove');
  const panel = h('div', { class: 'editor-panel card' },
    tabBar,
    body,
    h('footer', { class: 'editor-actions' },
      h('button', { class: 'big-button', type: 'button', onclick: cancel }, '✕ Cancel'),
      removeButton,
      h('button', { class: 'big-button primary', type: 'button', onclick: save }, '✓ Save'),
    ),
  );
  const el = h('div', { class: 'screen editor', hidden: true }, stage, panel);
  uiRoot().append(el);

  const keyboard = createKeyboard({
    maxLength: MAX_NAME_LENGTH,
    onChange: (value) => {
      draft.name = value;
      updateNameViews();
    },
    onDone: () => showTab('voice'),
  });

  // drag the stage to turn the character; a tap says hello
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    drag = { x: e.clientX, startX: e.clientX, startY: e.clientY, t: performance.now(), moved: false };
    try { stage.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    drag.x = e.clientX;
    if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) > 10) drag.moved = true;
    angle += dx * 0.012;
    spin = dx * 0.6;
  });
  const endDrag = () => {
    if (drag && !drag.moved && performance.now() - drag.t < 700) sayHello();
    drag = null;
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', () => { drag = null; });

  // ---------------------------------------------------------------- open/close
  function open(student) {
    isNew = !student;
    draft = structuredClone(student ?? newStudent('kid'));
    original = JSON.stringify(draft);
    for (const k of Object.keys(looksByType)) delete looksByType[k];
    looksByType[draft.type] = draft.look;
    keyboard.setValue(draft.name);
    removeButton.hidden = isNew;
    angle = 0.35;
    rebuildCharacter();
    showTab(isNew ? 'type' : 'look');
    el.hidden = false;
    layout();
  }

  function close() {
    keyboard.deactivate();
    el.hidden = true;
    if (character) {
      scene.remove(character.root);
      character.dispose();
      character = null;
    }
    onClose();
  }

  async function cancel() {
    if (JSON.stringify(draft) !== original) {
      const leave = await confirmDialog({ text: 'Stop without saving?', yes: 'Yes, stop', no: 'Keep going', icon: '✋' });
      if (!leave) return;
    }
    sfx.pop();
    close();
  }

  function save() {
    const name = draft.name.trim();
    if (!name) {
      sfx.squeak();
      showToast('Give your student a name first!', { icon: '✏️' });
      showTab('name');
      return;
    }
    if (roster.nameTaken(name, draft.id)) {
      sfx.squeak();
      showToast(`Someone is already called ${name}. Try another name!`, { icon: '✏️', seconds: 4 });
      showTab('name');
      return;
    }
    draft.name = name;
    draft.example = false; // it's hers now
    roster.put(draft);
    sfx.chime();
    showToast(isNew ? `${name} joined the class!` : `${name} is saved!`, { icon: '🎉' });
    close();
  }

  async function removeStudent() {
    const name = draft.name.trim() || 'this student';
    const yes = await confirmDialog({ text: `Say goodbye to ${name}?`, yes: '👋 Goodbye', no: 'Keep', icon: '🥺' });
    if (!yes) return;
    roster.remove(draft.id);
    showToast(`Bye bye, ${name}!`, { icon: '👋' });
    close();
  }

  function sayHello() {
    if (!character) return;
    sfx.unlock();
    const line = pickLine(HELLO_LINES, draft.name ? draft : { ...draft, name: 'new here' });
    character.react();
    character.talk(speechSeconds(line) + 0.5);
    speakAs(draft, line);
  }

  // ---------------------------------------------------------------- preview
  function rebuildCharacter() {
    if (character) {
      scene.remove(character.root);
      character.dispose();
    }
    character = new Character(draft.type, draft.look);
    scene.add(character.root);
    updateNameViews();
    layout();
  }

  /** Aim the camera so the character sits centred in the see-through stage. */
  function layout() {
    if (el.hidden || !character) return;
    const canvas = view.renderer.domElement;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    const r = stage.getBoundingClientRect();
    const size = Math.max(character.info.height, character.info.drives ? 1.3 : 0) + 0.35;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height * 0.52;
    camera.aspect = W / H;
    camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
    const visible = size / ((Math.min(r.height, r.width * 1.3) * 0.62) / H);
    const dist = visible / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.position.set(0, size * 0.45 + dist * 0.2, dist);
    camera.lookAt(0, size * 0.42, 0);
    camera.updateProjectionMatrix();
  }

  function update(dt) {
    if (!character) return;
    if (!drag) {
      angle += spin * dt * 0.02;
      spin *= Math.exp(-dt * 3);
    }
    character.root.rotation.y = angle + Math.sin(performance.now() / 1600) * 0.25;
    character.update(dt);
  }

  function updateNameViews() {
    stageName.textContent = draft.name.trim() || 'New student';
    const display = body.querySelector('.name-display');
    if (display) {
      display.firstChild.textContent = draft.name;
      display.classList.toggle('empty', !draft.name);
    }
    body.querySelectorAll('[data-name]').forEach((n) => { n.textContent = draft.name.trim() || 'your student'; });
  }

  // ---------------------------------------------------------------- tabs
  function showTab(id) {
    tab = id;
    tabBar.replaceChildren(...TABS.map((t) => h('button', {
      class: `tab${t.id === tab ? ' active' : ''}`,
      type: 'button',
      onclick: () => { sfx.pop(); showTab(t.id); },
    }, h('span', { class: 'tab-icon', 'aria-hidden': 'true' }, t.icon), t.label)));
    if (tab === 'name') keyboard.activate();
    else keyboard.deactivate();
    renderTab();
    body.scrollTop = 0;
  }

  function renderTab() {
    const scroll = body.scrollTop;
    const builders = { type: typeTab, look: lookTab, name: nameTab, voice: voiceTab };
    body.replaceChildren(...builders[tab]());
    body.scrollTop = scroll;
    updateNameViews();
  }

  const next = (to, label = 'Next') => h('button', { class: 'big-button next-button', type: 'button', onclick: () => { sfx.pop(); showTab(to); } }, `${label} ➜`);

  /** A grid of picture buttons (each drawn with the portrait maker). */
  function pictureChoices(options, selected, lookFor, onPick, { big = false } = {}) {
    return h('div', { class: `pic-grid${big ? ' big' : ''}` }, ...options.map((opt) => {
      const [type, look] = lookFor(opt);
      return h('button', {
        class: `pic-option${opt.id === selected ? ' selected' : ''}`,
        type: 'button',
        'aria-pressed': String(opt.id === selected),
        onclick: () => { sfx.pop(); onPick(opt.id); },
      }, h('img', { src: portraits.get(type, look), alt: '' }), h('span', {}, opt.label));
    }));
  }

  /** A row of color dots. */
  function swatches(colors, selected, onPick) {
    return h('div', { class: 'swatches' }, ...colors.map((color) => h('button', {
      class: `swatch${color === selected ? ' selected' : ''}`,
      type: 'button',
      style: { background: color },
      'aria-label': 'color',
      'aria-pressed': String(color === selected),
      onclick: () => { sfx.pop(); onPick(color); },
    })));
  }

  function setLook(patch) {
    draft.look = { ...draft.look, ...patch };
    looksByType[draft.type] = draft.look;
    rebuildCharacter();
    renderTab();
  }

  function typeTab() {
    return [
      h('h2', {}, 'Who is your new student?'),
      pictureChoices(TYPES, draft.type, (t) => [t.id, looksByType[t.id] ?? DEFAULT_LOOKS[t.id]], (type) => {
        if (type === draft.type) return;
        draft.type = type;
        draft.look = looksByType[type] ??= randomLook(type);
        rebuildCharacter();
        renderTab();
        sayHello();
      }, { big: true }),
      next('look'),
    ];
  }

  function lookTab() {
    const L = draft.look;
    const section = (title, ...content) => h('section', { class: 'option-section' }, h('h3', {}, title), ...content);
    let sections;
    if (draft.type === 'kid') {
      sections = [
        section('Hair', pictureChoices(HAIR_STYLES, L.hair, (o) => ['kid', { ...L, hair: o.id }], (hair) => setLook({ hair }))),
        section('Hair color', swatches(HAIR_COLORS, L.hairColor, (hairColor) => setLook({ hairColor }))),
        section('Skin', swatches(SKIN_TONES, L.skin, (skin) => setLook({ skin }))),
        section('Shirt', swatches(CLOTHES_COLORS, L.shirt, (shirt) => setLook({ shirt }))),
        section('Glasses', pictureChoices(
          [{ id: 'no', label: 'No glasses' }, { id: 'yes', label: 'Glasses' }],
          L.glasses ? 'yes' : 'no',
          (o) => ['kid', { ...L, glasses: o.id === 'yes' }],
          (id) => setLook({ glasses: id === 'yes' }),
        )),
      ];
    } else if (draft.type === 'plush') {
      sections = [
        section('Animal', pictureChoices(ANIMALS, L.animal, (o) => ['plush', { ...L, animal: o.id }], (animal) => setLook({ animal }))),
        section('Color', swatches(PLUSH_COLORS, L.color, (color) => setLook({ color }))),
      ];
    } else {
      sections = [section('Color', swatches(VEHICLE_COLORS, L.color, (color) => setLook({ color })))];
    }
    return [...sections, next('name')];
  }

  function nameTab() {
    const display = h('div', { class: `name-display${draft.name ? '' : ' empty'}` }, h('span', {}, draft.name), h('span', { class: 'caret' }));
    return [
      h('h2', {}, 'What is their name?'),
      display,
      keyboard.el,
      h('section', { class: 'option-section pronoun-row' },
        h('h3', {}, 'Call ', h('span', { 'data-name': '' }), ':'),
        h('div', { class: 'choice-row' }, ...PRONOUNS.map((p) => h('button', {
          class: `big-button choice${draft.pronoun === p.id ? ' selected' : ''}`,
          type: 'button',
          onclick: () => { sfx.pop(); draft.pronoun = p.id; renderTab(); },
        }, p.label))),
      ),
    ];
  }

  function voiceTab() {
    const variantLabel = h('span', { class: 'variant-label' }, '');
    voiceVariantCount().then((n) => {
      const choices = Math.max(n, 3); // even one device voice gets 3 speeds
      variantLabel.textContent = `Voice ${(draft.voice.variant % choices) + 1} of ${choices}`;
    });
    return [
      h('h2', {}, 'How does ', h('span', { 'data-name': '' }), ' sound?'),
      h('div', { class: 'choice-row' }, ...TONES.map((t) => h('button', {
        class: `big-button choice tall${draft.voice.tone === t.id ? ' selected' : ''}`,
        type: 'button',
        onclick: () => { draft.voice.tone = t.id; renderTab(); sayHello(); },
      }, h('span', { class: 'choice-icon', 'aria-hidden': 'true' }, t.icon), t.label))),
      h('div', { class: 'choice-row' },
        h('button', {
          class: 'big-button',
          type: 'button',
          onclick: async () => {
            const n = await voiceVariantCount();
            draft.voice.variant = (draft.voice.variant + 1) % Math.max(n, 3);
            renderTab();
            sayHello();
          },
        }, h('span', { 'aria-hidden': 'true' }, '🔁'), ' Try another voice'),
        variantLabel,
      ),
      h('button', { class: 'big-button next-button', type: 'button', onclick: sayHello }, h('span', { 'aria-hidden': 'true' }, '🔊'), ' Hear me'),
    ];
  }

  window.addEventListener('resize', () => requestAnimationFrame(layout));

  return {
    open,
    get isOpen() {
      return !el.hidden;
    },
    scene,
    camera,
    update,
    layout,
  };
}
