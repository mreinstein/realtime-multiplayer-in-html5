import fixed from './lib/fixed.js';
import { PHYSICS_FRAME_TIME } from './constants.js';


export default function physics_movement_vector_from_direction (playerspeed, x, y) {
    // Must be fixed step, at physics sync speed.
    return [
        fixed(x * (playerspeed * PHYSICS_FRAME_TIME)),
        fixed(y * (playerspeed * PHYSICS_FRAME_TIME))
    ];
}
