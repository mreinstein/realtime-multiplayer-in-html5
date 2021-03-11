import fixed from './fixed.js';


// Simple linear interpolation
function lerp (p, n, t) {
	let _t = Number(t);
	_t = fixed(Math.max(0, Math.min(1, _t)));
	return fixed(p + _t * (n - p));
}

// Simple linear interpolation between 2 vectors
export default function v_lerp (v, tv, t) {
	return [ lerp(v[0], tv[0], t), lerp(v[1], tv[1], t) ];
}
