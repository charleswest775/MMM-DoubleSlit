// Checks for the double slit: the photons land by the two-slit pattern, the fringes are where
// optics puts them, watching the slits removes them, and the page stays cheap.
// Run: node --test
const test = require("node:test");
const assert = require("node:assert");
const { DoubleSlit, WhichPath } = require("../simulations/double-slit.js");
const { LAMBDA, A, D, L, X } = DoubleSlit.consts;

// a repeatable random stream (mulberry32)
const seeded = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

test("bright fringes every λL/d = 2.13 mm, dark between; the band ends at λL/a = 13.3 mm", () => {
	const P = (LAMBDA * L) / D;
	assert.ok(Math.abs(P - 2.128e-3) < 1e-6);
	for (let k = 0; k < 5; k++) {
		assert.ok(DoubleSlit.pattern((k + 0.5) * P, false) < 1e-20);                           // dark
		assert.ok(DoubleSlit.pattern(k * P, false) > DoubleSlit.pattern((k + 0.1) * P, false)); // brightest
	}
	assert.ok(DoubleSlit.pattern((LAMBDA * L) / A, true) < 1e-20);
});

test("the photons land by the pattern: a histogram of 400,000 of them matches its integral", () => {
	const rand = seeded(1), bins = 80, n = 400000, h = new Float64Array(bins);
	for (let i = 0; i < n; i++) h[Math.floor(((DoubleSlit.land(false, rand) + X) / (2 * X)) * bins)]++;
	// the pattern integrated over each bin
	const w = new Float64Array(bins);
	for (let b = 0; b < bins; b++) for (let k = 0; k < 200; k++) w[b] += DoubleSlit.pattern(-X + ((b + (k + 0.5) / 200) * 2 * X) / bins, false);
	const total = w.reduce((a, b) => a + b, 0);
	for (let b = 0; b < bins; b++) {
		const expect = (n * w[b]) / total;
		assert.ok(Math.abs(h[b] - expect) < 5 * Math.sqrt(expect) + 3, `bin ${b}: ${h[b]} vs ${expect.toFixed(0)}`);
	}
});

test("the stripes share out the band's light: averaged over the fringes, cos² is ½", () => {
	let both = 0, band = 0;
	for (let i = 0; i < 100000; i++) {
		const x = -X + ((i + 0.5) * 2 * X) / 100000;
		both += DoubleSlit.pattern(x, false); band += DoubleSlit.pattern(x, true);
	}
	assert.ok(Math.abs(both / band - 0.5) < 0.01, `${both / band}`);
});

test("fringe contrast: near 1 with nobody watching, near 0 when watched", () => {
	for (const [Sim, lo, hi] of [[DoubleSlit, 0.9, 1], [WhichPath, 0, 0.08]]) {
		const s = new Sim();
		const ctx = { fillRect () {}, set fillStyle (v) {}, set globalAlpha (v) {}, set globalCompositeOperation (v) {} };
		s.layout(900, 900);
		s.drawHits(ctx, 60000);
		const c = s.contrast();
		assert.ok(c >= lo && c <= hi, `${Sim.name}: ${c}`);
	}
});

test("the page lands its photons within a 45 s page, changing the canvas at most 5 times a second, then rests", () => {
	const s = new DoubleSlit();
	const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
	let changes = 0, worst = 0, second = 0, frames = 0;
	const hits = s.drawHits.bind(s);
	s.drawHits = (c, k) => { changes++; hits(c, k); };
	while (!s.resting && frames < 2000) {
		s.step(1 / 20); s.draw(ctx, 900, 900); frames++;
		if (frames % 20 === 0) { worst = Math.max(worst, changes - second); second = changes; }
	}
	assert.strictEqual(s.n, DoubleSlit.TOTAL);
	assert.ok(frames / 20 <= 43, `${frames / 20} s`); // done within a 45 s page
	assert.ok(worst <= 5, `${worst} changes in a second`);
	assert.ok(!/NaN|undefined/.test(s.readout()));
});
