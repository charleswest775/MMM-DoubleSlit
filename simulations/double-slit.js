/* The double slit, one photon at a time. Green laser light (532 nm), so faint that one photon
 * crosses the apparatus at a time, passes two slits 0.04 mm wide and 0.25 mm apart and lands on
 * a screen 1 m beyond. Each photon lands in one place, at random; only together do they show
 * where each was likely to land: in bright fringes, where the waves through the two slits arrive
 * in step, and nowhere where they arrive out of step.
 *
 * Each landing place is drawn from the Fraunhofer (far-field) pattern of two slits, exactly, by
 * rejection sampling:
 *   P(x) ∝ cos²(π d x / λL) · sinc²(π a x / λL)
 * The slits are long and the light spread along them, so across the screen is all that matters;
 * up it, a photon lands anywhere.
 *
 * In the second story each slit is watched, so every photon's path is known. The two ways through
 * no longer interfere and the probabilities add, not the waves: P(x) ∝ sinc²(π a x / λL), one
 * broad band, the pattern of either slit alone (in the far field both fall in the same place).
 *
 * Drawn for the Pi: at first one photon at a time, then, as they come faster, in batches, so the
 * canvas changes at most five times a second; then it rests on the picture.
 */
(function (root) {
	const NM = 1e-9, MM = 1e-3;
	const LAMBDA = 532 * NM, A = 0.04 * MM, D = 0.25 * MM, L = 1;
	const X = 20 * MM;             // the screen shown: ±20 mm
	const GROW = 4.4;              // s: the rate grows e-fold in this
	const START = 5.75;            // photons by time t: START (e^(t/GROW) − 1)
	const TOTAL = 80000;           // then rest (at 42 s: a 45 s page)
	const CHANGES = 5;             // the canvas changes at most this often a second
	const GREEN = "rgb(90,255,110)";

	const sinc = (u) => (Math.abs(u) < 1e-9 ? 1 : Math.sin(u) / u);

	// the probability density, relative to its peak, of landing at x (metres) on the screen
	const pattern = (x, watched) => {
		const env = sinc((Math.PI * A * x) / (LAMBDA * L)) ** 2;
		return watched ? env : env * Math.cos((Math.PI * D * x) / (LAMBDA * L)) ** 2;
	};

	// one photon's landing place, from the pattern, by rejection: exact
	function land (watched, rand = Math.random) {
		for (;;) {
			const x = (2 * rand() - 1) * X;
			if (rand() < pattern(x, watched)) return x;
		}
	}

	// how many photons have landed by time t
	const landed = (t) => Math.min(TOTAL, Math.floor(START * (Math.exp(t / GROW) - 1)));

	class DoubleSlit {
		constructor ({ watched = false } = {}) {
			this.watched = watched;
			this.info = watched ? WhichPath.info : DoubleSlit.info;
			this.t = 0;
			this.n = 0;
			this.lastDraw = -1;
			// hits within two fringes of the middle, by where they fall in a fringe (12 bins a fringe)
			this.phase = new Float64Array(12);
		}

		step (dt) {
			this.t += dt;
		}

		layout (w, h) {
			if (this.w === w && this.h === h) return;
			this.w = w; this.h = h;
			this.top = Math.round(Math.min(0.24 * h, 230)); // the apparatus, seen from above
			this.left = 16; this.right = w - 16;
			this.bottom = h - 34;                          // the ruler below
			this.px = (x) => this.left + ((x + X) / (2 * X)) * (this.right - this.left);
			this.drawn = false;
		}

		draw (ctx, w, h) {
			this.layout(w, h);
			if (!this.drawn) { this.drawApparatus(ctx); this.drawn = true; }
			const due = landed(this.t);
			// one at a time while they come slowly, then in batches, CHANGES a second
			if (this.t - this.lastDraw < 1 / CHANGES - 1e-9) return;
			if (due > this.n) {
				this.lastDraw = this.t;
				this.drawHits(ctx, due - this.n);
			}
			if (this.n >= TOTAL) this.resting = true;
		}

		drawHits (ctx, k) {
			const early = this.n < 40, s = early ? 3 : 2;
			ctx.fillStyle = GREEN;
			ctx.globalAlpha = early ? 1 : 0.45;
			ctx.globalCompositeOperation = "lighter";
			const y0 = this.top + 4, span = this.bottom - 4 - y0 - s;
			for (let i = 0; i < k; i++) {
				const x = land(this.watched);
				ctx.fillRect(this.px(x) - s / 2, y0 + Math.random() * span, s, s);
				const f = (x * D) / (LAMBDA * L); // in fringes from the middle
				if (Math.abs(f) < 2) {
					this.phase[Math.floor((f + 2) * 12 + 0.5) % 12]++; // bins centred on the brightest and darkest
				}
			}
			ctx.globalCompositeOperation = "source-over";
			ctx.globalAlpha = 1;
			this.n += k;
		}

		// how clear the fringes are so far, near the middle: (most − least) / (most + least) of the
		// hits binned by where in a fringe they fell; 0 for none, near 1 for perfect ones
		contrast () {
			const most = Math.max(...this.phase), least = Math.min(...this.phase);
			return most + least > 0 ? (most - least) / (most + least) : 0;
		}

		// the laser, the slits and the screen, from above (not to scale), then the screen's frame
		// and a ruler in millimetres under it; drawn once
		drawApparatus (ctx) {
			const { w, top } = this, cx = w / 2, barrier = top * 0.5, gap = 26;
			ctx.fillStyle = "#000";
			ctx.fillRect(0, 0, w, this.h);
			ctx.font = "15px 'Roboto Condensed', sans-serif";
			ctx.textBaseline = "middle";

			// the laser, and its beam down to the slits
			ctx.fillStyle = "#333";
			ctx.fillRect(cx - 16, 8, 32, 18);
			ctx.strokeStyle = GREEN;
			ctx.globalAlpha = 0.8;
			ctx.lineWidth = 2;
			ctx.beginPath(); ctx.moveTo(cx, 26); ctx.lineTo(cx, barrier); ctx.stroke();

			// the barrier, with its two slits
			ctx.globalAlpha = 1;
			ctx.strokeStyle = "#888";
			ctx.lineWidth = 4;
			ctx.beginPath();
			ctx.moveTo(cx - 150, barrier); ctx.lineTo(cx - gap - 4, barrier);
			ctx.moveTo(cx - gap + 4, barrier); ctx.lineTo(cx + gap - 4, barrier);
			ctx.moveTo(cx + gap + 4, barrier); ctx.lineTo(cx + 150, barrier);
			ctx.stroke();

			// from each slit, light spreading to the whole screen
			ctx.strokeStyle = GREEN;
			ctx.lineWidth = 1;
			ctx.globalAlpha = 0.18;
			for (const sx of [cx - gap, cx + gap]) {
				for (let k = 0; k <= 8; k++) {
					ctx.beginPath(); ctx.moveTo(sx, barrier); ctx.lineTo(this.left + (k / 8) * (this.right - this.left), top - 6); ctx.stroke();
				}
			}
			ctx.globalAlpha = 1;

			// a detector at each slit, when the path is watched
			if (this.watched) {
				ctx.strokeStyle = "#ff6b6b";
				ctx.lineWidth = 2;
				for (const sx of [cx - gap, cx + gap]) {
					ctx.beginPath(); ctx.arc(sx, barrier, 11, 0, 2 * Math.PI); ctx.stroke();
				}
			}

			ctx.fillStyle = "#888";
			ctx.textAlign = "left";
			ctx.fillText("laser, 532 nm, one photon at a time", cx + 26, 17);
			ctx.fillText(this.watched ? "a detector at each slit" : "two slits, 0.04 mm wide, 0.25 mm apart", cx + 160, barrier);
			ctx.textAlign = "right";
			ctx.fillText("seen from above, not to scale", cx - 160, barrier);
			ctx.textAlign = "left";
			ctx.fillText("the screen, 1 m beyond, seen face on", this.left, top - 16);

			// the screen's frame and a ruler
			ctx.strokeStyle = "#333";
			ctx.lineWidth = 1;
			ctx.strokeRect(this.left - 0.5, top - 0.5, this.right - this.left + 1, this.bottom - top + 1);
			ctx.fillStyle = "#777";
			ctx.textAlign = "center";
			ctx.textBaseline = "top";
			for (let mm = -20; mm <= 20; mm++) {
				const x = Math.round(this.px(mm * MM)) + 0.5, long = mm % 5 === 0;
				ctx.beginPath(); ctx.moveTo(x, this.bottom + 1); ctx.lineTo(x, this.bottom + (long ? 9 : 5)); ctx.stroke();
				if (long && Math.abs(mm) < 20) ctx.fillText(mm === 0 ? "0" : `${mm > 0 ? "" : "−"}${Math.abs(mm)} mm`, x, this.bottom + 12);
			}
		}

		readout () {
			const n = this.n.toLocaleString("en");
			const c = this.phase.reduce((a, b) => a + b, 0) >= 300 ? this.contrast().toFixed(2) : "–";
			return `photons: ${n}    ${this.watched ? "with the slits open and not watched, fringes would be" : "fringes"} ${((LAMBDA * L) / D / MM).toFixed(2)} mm apart\n` +
				`fringe contrast near the middle, so far: ${c}  (1: perfect fringes, 0: none)`;
		}
	}

	class WhichPath extends DoubleSlit {
		constructor () { super({ watched: true }); }
	}

	const eq = "P(x) ∝ cos²<span class=\"doubleslit-note\">(</span>π<i>d x</i> / λ<i>L</i><span class=\"doubleslit-note\">)</span> · sinc²<span class=\"doubleslit-note\">(</span>π<i>a x</i> / λ<i>L</i><span class=\"doubleslit-note\">)</span>";
	DoubleSlit.info = {
		title: "The double slit, one photon at a time",
		subtitle: "each photon lands in one place, at random; together they land in stripes",
		equations: [
			`${eq} &nbsp; <span class="doubleslit-note">λ = 532 nm, slits a = 0.04 mm wide, d = 0.25 mm apart, L = 1 m to the screen</span>`,
			"<span class=\"doubleslit-note\">Where each photon lands is drawn at random from this, the chance of landing at x: two waves, one through each slit, adding up in step (bright) or cancelling out of step (dark). No single photon shows a stripe, and no photon lands where they cancel. Geoffrey Taylor photographed the stripes in 1909 in light so faint that the exposure took three months; in 1989 Akira Tonomura's team filmed single electrons, one at a time, building up stripes the same way.</span>"
		]
	};
	WhichPath.info = {
		title: "The double slit, watched",
		subtitle: "the same photons, with a detector at each slit to see which way each one went",
		equations: [
			"P(x) ∝ ½ P<sub>left</sub>(x) + ½ P<sub>right</sub>(x) = sinc²<span class=\"doubleslit-note\">(</span>π<i>a x</i> / λ<i>L</i><span class=\"doubleslit-note\">)</span> &nbsp; <span class=\"doubleslit-note\">with the path known, chances add, not waves</span>",
			"<span class=\"doubleslit-note\">Knowing which slit each photon went through, even in principle, leaves nothing to interfere: the stripes are gone, and what builds up is either slit's pattern alone, one broad band (far from the slits, both fall in the same place). This is Feynman's \"only mystery\" of quantum mechanics.</span>"
		]
	};
	DoubleSlit.pattern = pattern;
	DoubleSlit.land = land;
	DoubleSlit.landed = landed;
	DoubleSlit.TOTAL = TOTAL;
	DoubleSlit.consts = { LAMBDA, A, D, L, X };

	root.DoubleSlitSimulations = root.DoubleSlitSimulations || {};
	root.DoubleSlitSimulations.doubleSlit = DoubleSlit;
	root.DoubleSlitSimulations.whichPath = WhichPath;
	if (typeof module !== "undefined") module.exports = { DoubleSlit, WhichPath };
})(typeof window !== "undefined" ? window : globalThis);
