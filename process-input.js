import physics_movement_vector_from_direction from './get-move-vector.js';


export default function process_input (playerspeed, player) {
    // It's possible to have recieved multiple inputs by now, so we process each one
    let x_dir = 0;
    let y_dir = 0;
    const ic = player.inputs.length;

    if (ic) {
        for (let j = 0; j < ic; ++j) {
            // don't process ones we already have simulated locally
            if (player.inputs[j].seq <= player.last_input_seq)
                continue;

            const input = player.inputs[j].inputs;
            const c = input.length;
            for (let i = 0; i < c; ++i) {
                const key = input[i];
                if (key == 'l')
                    x_dir -= 1;

                if (key == 'r')
                    x_dir += 1;

                if (key == 'd')
                    y_dir += 1;

                if (key == 'u')
                    y_dir -= 1;
            } // for all input values

        } // for each input command
    } // if we have inputs

    // we have a direction vector now, so apply the same physics as the client
    const resulting_vector = physics_movement_vector_from_direction(playerspeed, x_dir, y_dir);

    if (player.inputs.length) {
        // we can now clear the array since these have been processed
        player.last_input_time = player.inputs[ic-1].time;
        player.last_input_seq = player.inputs[ic-1].seq;
    }

    return resulting_vector;
}
