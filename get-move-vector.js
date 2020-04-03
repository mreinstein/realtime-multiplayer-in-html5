import fixed from './lib/fixed.js';


export default function physics_movement_vector_from_direction (playerspeed, x, y) {
    // Must be fixed step, at physics sync speed.
    return {
        x : fixed(x * (playerspeed * 0.015)),
        y : fixed(y * (playerspeed * 0.015))
    };
}
