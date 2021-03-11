import fixed from './fixed.js';


// Add a 2d vector with another one and return the resulting vector
export default function v_add (a, b) {
	return [ fixed(a[0] + b[0]), fixed(a[1] + b[1]) ];
}
