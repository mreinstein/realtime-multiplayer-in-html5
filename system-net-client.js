import ECS            from 'https://cdn.skypack.dev/ecs';
import handleCollision from './handle-collision.js';
import fixed          from './lib/fixed.js';
import pos            from './lib/pos.js';
import updatePhysics  from './update-physics.js';
import v_lerp         from './lib/v-lerp.js';
import { PHYSICS_FRAME_TIME } from '/constants.js';


function process_net_updates (client, core) {
    // No updates...
    if (!client.server_updates.length)
        return;

    // First : Find the position in the updates, on the timeline
    // We call this current_time, then we find the past_pos and the target_pos using this,
    // searching throught the server_updates array for current_time in between 2 other times.
    // Then :  other player position = lerp ( past_pos, target_pos, current_time );

    // Find the position in the timeline of updates we stored.
    const current_time = client.client_time;
    const count = client.server_updates.length-1;
    let target = null;
    let previous = null;

    // We look from the 'oldest' updates, since the newest ones
    // are at the end (list.length-1 for example). This will be expensive
    // only when our time is not found on the timeline, since it will run all
    // samples. Usually this iterates very little before breaking out with a target.
    for (let i = 0; i < count; ++i) {

        const point = client.server_updates[i];
        const next_point = client.server_updates[i+1];

        // Compare our point in time with the server times we have
        if (current_time > point.t && current_time < next_point.t) {
            target = next_point;
            previous = point;
            break;
        }
    }

    // With no target we store the last known server position and move to that instead
    if (!target) {
        target = client.server_updates[0];
        previous = client.server_updates[0];
    }

    // Now that we have a target and a previous destination,
    // We can interpolate between then based on 'how far in between' we are.
    // This is simple percentage maths, value/target = [0,1] range of numbers.
    // lerp requires the 0,1 value to lerp to? thats the one.

    if (!target || !previous)
        return;

    client.target_time = target.t;

    const difference = client.target_time - current_time;
    const max_difference = fixed(target.t - previous.t);
    let time_point = fixed(difference/max_difference);

    // Because we use the same target and previous in extreme cases
    // It is possible to get incorrect values due to division by 0 difference
    // and such. This is a safe guard and should probably not be here. lol.
    if ( isNaN(time_point) )
    	time_point = 0;
    if (time_point == -Infinity)
    	time_point = 0;
    if (time_point == Infinity)
    	time_point = 0;

    // The most recent server update
    const latest_server_data = client.server_updates[ client.server_updates.length-1 ];

    // These are the exact server positions from this tick, but only for the ghost
    const other_server_pos = core.players.self.host ? latest_server_data.cp : latest_server_data.hp;

    // The other players positions in this timeline, behind us and in front of us
    const other_target_pos = core.players.self.host ? target.cp : target.hp;
    const other_past_pos = core.players.self.host ? previous.cp : previous.hp;

    // update the dest block, this is a simple lerp
    // to the target from the previous point in the server_updates buffer
    const other_pos = v_lerp(other_past_pos, other_target_pos, time_point);

    if (client.client_smoothing)
        core.players.other.pos = v_lerp( core.players.other.pos, other_pos, PHYSICS_FRAME_TIME*client.client_smooth);
    else
        core.players.other.pos = pos(other_pos);
}


function update_local_position (client, core) {
    // Work out the time we have since we updated the state
    //const t = (core.network_time - core.players.self.state_time) / PHYSICS_FRAME_TIME;

    const current_pos = core.players.self.cur_state.pos;

    // Make sure the visual position matches the states we have stored
    //core.players.self.pos = v_add( old_state, core.v_mul_scalar( core.v_sub(current_pos, old_state), t )  );
    core.players.self.pos = current_pos;
    
    // handle collision on client.
    handleCollision(core.world, core.players.self);
}


function connect_to_server (client, core) {  
    // Store a local reference to our connection to the server
    client.socket = io.connect();

    // When we connect, we are not 'connected' until we have a server id
    // and are placed in a game by the server. The server sends us a message for that.
    client.socket.on('connect', function () {
        core.players.self.state = 'connecting';
    });

    // Sent when we are disconnected (network, server down, etc)
    client.socket.on('disconnect', function (data) {
        ondisconnect(core, data)
    });

    // Sent each tick of the server simulation. This is our authoritive update
    client.socket.on('onserverupdate', function (data) {
        onserverupdate_received(data, client, core);
    });

    // Handle when we connect to the server, showing state and storing id's.
    client.socket.on('onconnected', function (data) {
        onconnected(core, data);
    });

    // On error we just show that we are not connected for now. Can print the data.
    client.socket.on('error', function (data) {
        ondisconnect(core, data)
    });

    // On message from the server, we parse the commands and send it to the handlers
    client.socket.on('message', function (data) {
        onnetmessage(client, core, data);
    });
}


function onserverupdate_received (data, client, core) {
    // Lets clarify the information we have locally. One of the players is 'hosting' and
    // the other is a joined in client, so we name these host and client for making sure
    // the positions we get from the server are mapped onto the correct local sprites
    const player_host = core.players.self.host ?  core.players.self : core.players.other;
    const player_client = core.players.self.host ?  core.players.other : core.players.self;
    const this_player = core.players.self;
        
    // Store the server time (this is offset by the latency in the network, by the time we get it)
    client.server_time = data.t;
    // Update our local offset time from the last server update
    client.client_time = client.server_time - client.interpolation_offset;

    // One approach is to set the position directly as the server tells you.
    // This is a common mistake and causes somewhat playable results on a local LAN, for example,
    // but causes terrible lag when any ping/latency is introduced. The player can not deduce any
    // information to interpolate with so it misses positions, and packet loss destroys this approach
    // even more so. See 'the bouncing ball problem' on Wikipedia.

   
    // Cache the data from the server, and then play the timeline back to the player with a
    // small delay (interpolation_offset), allowing interpolation between the points.
    client.server_updates.push(data);

    // we limit the buffer in seconds worth of updates
    // 60fps*buffer seconds = number of samples
    if (client.server_updates.length >= ( 60*client.buffer_size ))
        client.server_updates.splice(0,1);

    // We can see when the last tick we know of happened.
    // If client_time gets behind this due to latency, a snap occurs
    // to the last tick. Unavoidable, and a reallly bad connection here.
    // If that happens it might be best to drop the game after a period of time.
    //client.oldest_tick = client.server_updates[0].t;

    // Handle the latest positions from the server
    // and make sure to correct our local predictions, making the server have final say.
    process_net_prediction_correction(client, core);
}


function reset_positions (client, core) {

    const player_host = core.players.self.host ?  core.players.self : core.players.other;
    const player_client = core.players.self.host ?  core.players.other : core.players.self;

    // Host always spawns at the top left.
    player_host.pos = [ 20, 20 ];
    player_client.pos = [ 500, 200 ];

    // Make sure the local player physics is updated
    core.players.self.pos = pos(core.players.self.pos);
    core.players.self.cur_state.pos = pos(core.players.self.pos);
}


function onreadygame (client, core, data) {

    const server_time = parseFloat(data.replace('-','.'));

    const player_host = core.players.self.host ?  core.players.self : core.players.other;
    const player_client = core.players.self.host ?  core.players.other : core.players.self;

    core.network_time = server_time + client.net_latency;
    console.log('server time is about ' + core.network_time);

	// store their info colors for clarity. server is always blue
	player_host.info_color = '#2288cc';
	player_client.info_color = '#cc8822';

	// update their information
	player_host.state = 'local_pos(hosting)';
	player_client.state = 'local_pos(joined)';

	core.players.self.state = 'YOU ' + core.players.self.state;

	// make sure colors are synced up
    client.socket.send('c.' + core.players.self.color);
}


function onjoingame (client, core, data) {
	// We are not the host
	core.players.self.host = false;
	// Update the local state
	core.players.self.state = 'connected.joined.waiting';
	core.players.self.info_color = '#00bb00';

	// Make sure the positions match servers and other clients
	reset_positions(client, core);
}


function onhostgame (client, core, data) {
	// The server sends the time when asking us to host, but it should be a new game.
	// so the value will be really small anyway (15 or 16ms)
	const server_time = parseFloat(data.replace('-','.'));

	// Get an estimate of the current time on the server
	core.network_time = server_time + client.net_latency;

	// Set the flag that we are hosting, this helps us position respawns correctly
	core.players.self.host = true;

	// Update debugging information to display state
	core.players.self.state = 'hosting.waiting for a player';
	core.players.self.info_color = '#cc0000';

	//Make sure we start in the correct place as the host.
    reset_positions(client, core);
}


function onconnected (core, data) {
    // The server responded that we are now in a game,
    // this lets us store the information about ourselves and set the colors
    // to show we are now ready to be playing.
    core.players.self.id = data.id;
    core.players.self.info_color = '#cc0000';
    core.players.self.state = 'connected';
    core.players.self.online = true;
}


function on_otherclientcolorchange (core, data) {
    core.players.other.color = data;
}


function onping (client, data) {
    client.net_ping = Date.now() - parseFloat(data);
    client.net_latency = client.net_ping / 2;
}


function onnetmessage (client, core, data) {
    const commands = data.split('.');
    const command = commands[0];
    const subcommand = commands[1] || null;
    const commanddata = commands[2] || null;

    switch(command) {
        case 's': // server message
            switch(subcommand) {

                case 'h' : // host a game requested
                    onhostgame(client, core, commanddata); break;

                case 'j' : // join a game requested
                    onjoingame(client, core, commanddata); break;

                case 'r' : // ready a game requested
                    onreadygame(client, core, commanddata); break;

                case 'e' : // end game requested
                    ondisconnect(core, commanddata); break;

                case 'p' : // server ping
                    onping(client, commanddata); break;

                case 'c' : // other player changed colors
                    on_otherclientcolorchange(core, commanddata); break;

            }

        break;
    } 
}


function ondisconnect (core, data) {
    // When we disconnect, we don't know if the other player is
    // connected or not, and since we aren't, everything goes to offline

    core.players.self.info_color = 'rgba(255,255,255,0.1)';
    core.players.self.state = 'not-connected';
    core.players.self.online = false;

    core.players.other.info_color = 'rgba(255,255,255,0.1)';
    core.players.other.state = 'not-connected';
}


function process_net_prediction_correction (client, core) {
    // No updates...
    if (!client.server_updates.length)
        return;

    // The most recent server update
    const latest_server_data = client.server_updates[client.server_updates.length-1];

    // Our latest server position
    const my_server_pos = core.players.self.host ? latest_server_data.hp : latest_server_data.cp;

    // handle our local input prediction,
    // by correcting it with the server and reconciling its differences

    const my_last_input_on_server = core.players.self.host ? latest_server_data.his : latest_server_data.cis;
    if (!my_last_input_on_server)
        return;

    // The last input sequence index in my local input list
    let lastinputseq_index = -1;
    // Find this input in the list, and store the index
    for (let i = 0; i < core.players.self.inputs.length; ++i) {
        if (core.players.self.inputs[i].seq == my_last_input_on_server) {
            lastinputseq_index = i;
            break;
        }
    }

    // crop the list of any updates we have already processed
    if (lastinputseq_index < 0)
        return;

    // we have now gotten an acknowledgement from the server that our inputs here have been accepted
    // and that we can predict from this known position instead

    // remove the rest of the inputs we have confirmed on the server
    const number_to_clear = Math.abs(lastinputseq_index + 1);
    core.players.self.inputs.splice(0, number_to_clear);

    // The player is now located at the new server position, authoritive server
    core.players.self.cur_state.pos = pos(my_server_pos);
    core.players.self.last_input_seq = lastinputseq_index;
    
    // Now we reapply all the inputs that we have locally that
    // the server hasn't yet confirmed. This will 'keep' our position the same,
    // but also confirm the server position at the same time.
    updatePhysics(client, core);
    update_local_position(client, core);
}


export default function netClientSystem (world) {

    // run at the start of each game frame before fixedUpdate or update
    // @param Number dt elapsed time in milliseconds since last invocation
    const onPreUpdate = function (dt) {
        dt = dt / 1000.0;  // convert ms to seconds

        for (const entity of ECS.getEntities(world, [ 'net_client', 'game_core' ]))
            entity.game_core.network_time += dt;
    };

    const onUpdate = function (dt) {

    	const newTime = performance.now();

        for (const entity of ECS.getEntities(world, [ 'net_client', 'game_core' ])) {
        	const client = entity.net_client;
        	const game = entity.game_core;

        	if (!client.socket) {
    			connect_to_server(client, game);
    			continue;
        	}

            // Ping the server every second, to determine the latency between
	    	// client and server and calculate roughly how our connection is doing
			if (newTime - client.last_ping_time >= 1000) {
				client.last_ping_time = newTime - client.fake_lag;
				client.socket.send('p.' + client.last_ping_time);
			}

		    // Network player just gets drawn normally, with interpolation from
		    // the server updates, smoothing out the positions from the past.
		     process_net_updates(client, game);

		    // When we are doing client side prediction, we smooth out our position
		    // across frames using local input states we have stored.
		    update_local_position(client, game);
        }
    };

    return { onPreUpdate, onUpdate }
}
