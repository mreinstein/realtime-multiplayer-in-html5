import physics_movement_vector_from_direction from './get-move-vector.js';


export default function process_input (core, player ) {
    // It's possible to have recieved multiple inputs by now,
    // so we process each one
    var x_dir = 0;
    var y_dir = 0;
    var ic = player.inputs.length;
    if (ic) {
        for (var j = 0; j < ic; ++j) {
            //don't process ones we already have simulated locally
            if (player.inputs[j].seq <= player.last_input_seq) continue;

            var input = player.inputs[j].inputs;
            var c = input.length;
            for (var i = 0; i < c; ++i) {
                var key = input[i];
                if (key == 'l') {
                    x_dir -= 1;
                }
                if (key == 'r') {
                    x_dir += 1;
                }
                if (key == 'd') {
                    y_dir += 1;
                }
                if (key == 'u') {
                    y_dir -= 1;
                }
            } // for all input values

        } // for each input command
    } // if we have inputs

    // we have a direction vector now, so apply the same physics as the client
    const resulting_vector = physics_movement_vector_from_direction(core.playerspeed, x_dir, y_dir);
    if (player.inputs.length) {
        // we can now clear the array since these have been processed
        player.last_input_time = player.inputs[ic-1].time;
        player.last_input_seq = player.inputs[ic-1].seq;
    }

    return resulting_vector;
}
