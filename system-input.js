import ECS                                    from 'https://cdn.skypack.dev/ecs';
import fixed                                  from './lib/fixed.js';
import keyboard                               from './lib/keyboard.js';
import physics_movement_vector_from_direction from './get-move-vector.js';


export default function inputSystem (world) {

    const onUpdate = function (dt) {
        // get all of the entities in the world that pass the filter
        for (const entity of ECS.getEntities(world, [ 'net_client', 'game_core' ])) {
            const client = entity.net_client;
            const core = entity.game_core;

            // takes input from the client and keeps a record,
            // It also sends the input information to the server immediately
            // as it is pressed. It also tags each input with a sequence number.

            let x_dir = 0;
            let y_dir = 0;
            const input = [ ];

            if (keyboard.pressed('A') || keyboard.pressed('left')) {
                x_dir = -1;
                input.push('l');
            }

            if (keyboard.pressed('D') || keyboard.pressed('right')) {
                x_dir = 1;
                input.push('r');
            }

            if (keyboard.pressed('S') || keyboard.pressed('down')) {
                y_dir = 1;
                input.push('d');
            }

            if (keyboard.pressed('W') || keyboard.pressed('up')) {
                y_dir = -1;
                input.push('u');
            }

            if (input.length) {
                // Update what sequence we are on now
                client.input_seq += 1;

                // Store the input state as a snapshot of what happened.
                core.players.self.inputs.push({
                    inputs: input,
                    time: fixed(core.network_time),
                    seq: client.input_seq
                });

                // Send the packet of information to the server.
                // The input packets are labelled with an 'i' in front.
                let server_packet = 'i.';
                    server_packet += input.join('-') + '.';
                    server_packet += core.network_time.toFixed(3).replace('.','-') + '.';
                    server_packet += client.input_seq;

                client.socket.send(server_packet);
            }
        }
    }

    return { onUpdate }
}
