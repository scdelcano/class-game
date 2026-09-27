/*
 * Writes on the classroom chalkboard (a canvas texture): problems, answers,
 * checkmarks, dot pictures for hints, and lesson summaries. Future lessons
 * (reading, spelling) can use the same writer.
 */
const CHALK = '"Chalkboard SE", "Comic Sans MS", "Comic Neue", "Nunito", "Roboto", sans-serif';
const COLORS = { white: 'rgba(255,255,255,0.93)', yellow: '#fff3a6', pink: '#ffb3c7', green: '#b6f5b0', red: '#ff9b9b', blue: '#a8dcff' };

export function createBoardWriter(canvas, texture) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const welcome = ctx.getImageData(0, 0, W, H);

  function blank() {
    ctx.fillStyle = '#2f7d5b';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.beginPath();
      ctx.ellipse((i * 173) % W, (i * 97) % H, 110, 34, i, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function chalk(text, x, y, size, color = COLORS.white, align = 'left') {
    ctx.font = `700 ${size}px ${CHALK}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.45;
    ctx.fillText(text, x + 2, y + 1.5);
    ctx.globalAlpha = 0.95;
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;
    return ctx.measureText(text).width;
  }

  function line(x1, y1, x2, y2, color, width = 8) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function check(x, y, s) {
    ctx.strokeStyle = COLORS.green;
    ctx.lineWidth = s * 0.16;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + s * 0.35, y + s * 0.35);
    ctx.lineTo(x + s, y - s * 0.45);
    ctx.stroke();
  }

  /** Dots that show what the problem means (rows × columns, or two groups). */
  function dots(problem, x0, y0, w, h) {
    const { a, b } = problem;
    const op = problem.fact.op;
    let rows;
    let cols;
    let colorAt;
    if (op === '×' || op === '÷') {
      // a × b: a rows of b. c ÷ b: b rows (groups), answer in each row.
      rows = op === '×' ? a : b;
      cols = op === '×' ? b : problem.answer;
      if (rows > cols) [rows, cols] = [cols, rows]; // the board is wide: long side across
      colorAt = (r) => (r % 2 ? COLORS.yellow : COLORS.blue);
    } else {
      // + and −: a first group and a second group, 10 to a row
      const total = op === '+' ? a + b : a;
      cols = Math.min(10, Math.max(total, 1));
      rows = Math.ceil(total / 10) || 1;
      colorAt = (r, c) => {
        const i = r * 10 + c;
        if (i >= total) return null;
        if (op === '+') return i < a ? COLORS.blue : COLORS.yellow;
        return i >= a - b ? 'cross' : COLORS.blue;
      };
    }
    if (!rows || !cols) {
      chalk('0', x0 + w / 2, y0 + h / 2, 80, COLORS.yellow, 'center');
      return;
    }
    const cell = Math.min(w / cols, h / rows, 46);
    const ox = x0 + (w - cell * cols) / 2;
    const oy = y0 + (h - cell * rows) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const color = colorAt(r, c);
        if (!color) continue;
        const cx = ox + (c + 0.5) * cell;
        const cy = oy + (r + 0.5) * cell;
        if (color === 'cross') {
          ctx.fillStyle = COLORS.blue;
          ctx.globalAlpha = 0.35;
          ctx.beginPath(); ctx.arc(cx, cy, cell * 0.34, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          line(cx - cell * 0.3, cy - cell * 0.3, cx + cell * 0.3, cy + cell * 0.3, COLORS.red, 3);
        } else {
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(cx, cy, cell * 0.34, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  const done = () => { texture.needsUpdate = true; };

  return {
    /** Back to "Good morning, class!". */
    welcome() {
      ctx.putImageData(welcome, 0, 0);
      done();
    },

    /**
     * @param {object} opts
     * @param {string} opts.title        small heading
     * @param {object} opts.problem      from math-facts present()
     * @param {number|null} [opts.answer]      answer being shown (null = "?")
     * @param {'right'|'wrong'|null} [opts.mark]
     * @param {number|null} [opts.correction]  right answer written after a crossed-out one
     * @param {boolean} [opts.hint]      draw the dots picture
     */
    problem({ title, problem, answer = null, mark = null, correction = null, hint = false }) {
      blank();
      chalk(title, 28, 36, 30, COLORS.yellow);
      const size = hint ? 84 : 116;
      const left = 40;
      const y = H * 0.56;
      ctx.font = `700 ${size}px ${CHALK}`;
      let x = left + chalk(`${problem.text} = `, left, y, size);
      if (answer === null) {
        chalk('?', x, y, size, COLORS.pink);
      } else {
        const w = chalk(String(answer), x, y, size, mark === 'wrong' ? COLORS.pink : COLORS.yellow);
        if (mark === 'wrong') {
          line(x - 6, y + size * 0.3, x + w + 6, y - size * 0.3, COLORS.red, 9);
          if (correction !== null) chalk(String(correction), x + w + 24, y, size, COLORS.yellow);
        }
        if (mark === 'right') check(x + w + 26, y, size * 0.6);
      }
      if (hint) dots(problem, W * 0.6, 58, W * 0.38, H - 80);
      done();
    },

    /**
     * A word or sentence for reading and spelling lessons.
     * @param {object} opts
     * @param {string} opts.title
     * @param {string} opts.text          what is written (a word, a sentence, or a student's spelling)
     * @param {boolean} [opts.sentence]   smaller, wrapped text
     * @param {string[]} [opts.parts]     "sound it out" chunks, drawn in two colors with dots between
     * @param {string} [opts.tip]         small tip line at the bottom (e.g. "un- means not")
     * @param {'right'|'wrong'|null} [opts.mark]
     * @param {string|null} [opts.correction]  right spelling written under a crossed-out one
     */
    word({ title, text, sentence = false, parts = null, tip = null, mark = null, correction = null }) {
      blank();
      chalk(title, 28, 36, 30, COLORS.yellow);
      const y = correction ? H * 0.42 : H * 0.52;
      if (sentence) {
        // wrap into lines that fit the board
        const size = 58;
        ctx.font = `700 ${size}px ${CHALK}`;
        const lines = [];
        let lineText = '';
        for (const w of text.split(' ')) {
          const trial = lineText ? `${lineText} ${w}` : w;
          if (ctx.measureText(trial).width > W - 90 && lineText) {
            lines.push(lineText);
            lineText = w;
          } else lineText = trial;
        }
        lines.push(lineText);
        lines.forEach((l, i) => chalk(l, W / 2, y + (i - (lines.length - 1) / 2) * (size * 1.25), size, COLORS.white, 'center'));
      } else if (parts && parts.length > 1) {
        // sound it out: un · hap · py
        const size = 104;
        ctx.font = `700 ${size}px ${CHALK}`;
        const gap = ' · ';
        const total = parts.reduce((sum, p, i) => sum + ctx.measureText(p).width + (i ? ctx.measureText(gap).width : 0), 0);
        let x = (W - total) / 2;
        parts.forEach((p, i) => {
          if (i) x += chalk(gap, x, y, size, 'rgba(255,255,255,0.5)');
          x += chalk(p, x, y, size, i % 2 ? COLORS.yellow : COLORS.blue);
        });
      } else {
        let size = 130;
        ctx.font = `700 ${size}px ${CHALK}`;
        while (ctx.measureText(text).width > W - 120 && size > 50) {
          size -= 6;
          ctx.font = `700 ${size}px ${CHALK}`;
        }
        const w = ctx.measureText(text).width;
        const x = (W - w) / 2;
        chalk(text, x, y, size, mark === 'wrong' ? COLORS.pink : COLORS.white);
        if (mark === 'wrong') line(x - 8, y + size * 0.25, x + w + 8, y - size * 0.25, COLORS.red, 9);
        if (mark === 'right') check(x + w + 24, y, size * 0.5);
      }
      if (correction) chalk(correction, W / 2, H * 0.74, 84, COLORS.yellow, 'center');
      if (tip) chalk(tip, W / 2, H - 28, 30, COLORS.yellow, 'center');
      done();
    },

    /** Big message across the board (lesson start or end). */
    message(big, small = '') {
      blank();
      chalk(big, W / 2, small ? 135 : H / 2, 96, COLORS.yellow, 'center');
      if (small) chalk(small, W / 2, 245, 46, COLORS.white, 'center');
      done();
    },
  };
}
