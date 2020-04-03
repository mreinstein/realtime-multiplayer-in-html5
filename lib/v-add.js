import fixed from './fixed.js';


// Add a 2d vector with another one and return the resulting vector
export default function v_add (a,b) {
	return { x: fixed(a.x+b.x), y: fixed(a.y+b.y) };
}


// Subtract a 2d vector with another one and return the resulting vector
//game_core.prototype.v_sub = function (a,b) { return { x: fixed(a.x-b.x), y: fixed(a.y-b.y) }; };

// Multiply a 2d vector with a scalar value and return the resulting vector
//game_core.prototype.v_mul_scalar = function (a,b) { return {x: fixed(a.x*b), y: fixed(a.y*b) }; };
