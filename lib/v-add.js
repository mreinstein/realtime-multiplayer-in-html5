import fixed from './fixed.js';


// Add a 2d vector with another one and return the resulting vector
export default function v_add (a,b) {
	return { x: fixed(a.x+b.x), y: fixed(a.y+b.y) };
}
