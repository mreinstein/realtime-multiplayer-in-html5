import physics_movement_vector_from_direction from './get-move-vector.js';


export default function processInput (playerspeed, player) {
    // It's possible to have received multiple inputs by now, so we process each one
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
            }
        }

        // clear the array since the new inputs have all been processed
        player.last_input_seq = player.inputs[ic-1].seq;
    }

    // we have a direction vector now, so apply the same physics as the client
    return physics_movement_vector_from_direction(playerspeed, x_dir, y_dir);
}
