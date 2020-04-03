/*  Copyright 2012-2016 Sven "underscorediscovery" Bergström

written by : http://underscorediscovery.ca
written for : http://buildnewgames.com/real-time-multiplayer/

MIT Licensed.
*/
import THREEx          from './lib/keyboard.js';
import check_collision from './check-collision.js';
import fixed           from './lib/fixed.js';
import gameCore        from './game.core.js';
import physics_movement_vector_from_direction from './get-move-vector.js';
import process_input   from './process-input.js';
import pos             from './lib/pos.js';
import v_add           from './lib/v-add.js';
import v_lerp          from './lib/v-lerp.js';


function client_handle_input (core) {
    //if (core.lit > core.local_time) return;
    //core.lit = core.local_time+0.5; // one second delay

    // This takes input from the client and keeps a record,
    // It also sends the input information to the server immediately
    // as it is pressed. It also tags each input with a sequence number.

    let x_dir = 0;
    let y_dir = 0;
    const input = [ ];
    core.client_has_input = false;

    if ( core.keyboard.pressed('A') ||
        core.keyboard.pressed('left')) {
        x_dir = -1;
        input.push('l');
    }

    if ( core.keyboard.pressed('D') ||
        core.keyboard.pressed('right')) {
        x_dir = 1;
        input.push('r');
    }

    if ( core.keyboard.pressed('S') ||
        core.keyboard.pressed('down')) {
        y_dir = 1;
        input.push('d');
    }

    if ( core.keyboard.pressed('W') ||
        core.keyboard.pressed('up')) {
        y_dir = -1;
        input.push('u');
    }

    if (input.length) {
        // Update what sequence we are on now
        core.input_seq += 1;

        // Store the input state as a snapshot of what happened.
        core.players.self.inputs.push({
            inputs : input,
            time : fixed(core.local_time),
            seq : core.input_seq
        });

        // Send the packet of information to the server.
        // The input packets are labelled with an 'i' in front.
        let server_packet = 'i.';
            server_packet += input.join('-') + '.';
            server_packet += core.local_time.toFixed(3).replace('.','-') + '.';
            server_packet += core.input_seq;

        core.socket.send(server_packet);

        // Return the direction if needed
        return physics_movement_vector_from_direction(core.playerspeed, x_dir, y_dir);

    } else {
        return { x: 0, y: 0 };
    }
}


function client_draw_info (core) {

    // We don't want this to be too distracting
    core.ctx.fillStyle = 'rgba(255,255,255,0.3)';

    // They can hide the help with the debug GUI
    if (core.show_help) {
        core.ctx.fillText('net_offset : local offset of others players and their server updates. Players are net_offset "in the past" so we can smoothly draw them interpolated.', 10 , 30);
        core.ctx.fillText('server_time : last known game time on server', 10 , 70);
        core.ctx.fillText('client_time : delayed game time on client for other players only (includes the net_offset)', 10 , 90);
        core.ctx.fillText('net_latency : Time from you to the server. ', 10 , 130);
        core.ctx.fillText('net_ping : Time from you to the server and back. ', 10 , 150);
        core.ctx.fillText('fake_lag : Add fake ping/lag for testing, applies only to your inputs (watch server_pos block!). ', 10 , 170);
        core.ctx.fillText('client_smoothing/client_smooth : When updating players information from the server, it can smooth them out.', 10 , 210);
        core.ctx.fillText(' This only applies to other clients when prediction is enabled, and applies to local player with no prediction.', 170 , 230);
    }

    // Draw some information for the host
    if (core.players.self.host) {
        core.ctx.fillStyle = 'rgba(255,255,255,0.7)';
        core.ctx.fillText('You are the host', 10 , 465);
    }

    // Reset the style back to full white.
    core.ctx.fillStyle = 'rgba(255,255,255,1)';
}


function client_process_net_prediction_correction (core) {

    // No updates...
    if (!core.server_updates.length)
        return;

    // The most recent server update
    const latest_server_data = core.server_updates[core.server_updates.length-1];

        //Our latest server position
    var my_server_pos = core.players.self.host ? latest_server_data.hp : latest_server_data.cp;

        //Update the debug server position block
    core.ghosts.server_pos_self.pos = pos(my_server_pos);

            //here we handle our local input prediction ,
            //by correcting it with the server and reconciling its differences

        const my_last_input_on_server = core.players.self.host ? latest_server_data.his : latest_server_data.cis;
        if (my_last_input_on_server) {
                //The last input sequence index in my local input list
            let lastinputseq_index = -1;
                //Find this input in the list, and store the index
            for (let i = 0; i < core.players.self.inputs.length; ++i) {
                if (core.players.self.inputs[i].seq == my_last_input_on_server) {
                    lastinputseq_index = i;
                    break;
                }
            }

                //Now we can crop the list of any updates we have already processed
            if (lastinputseq_index != -1) {
                //so we have now gotten an acknowledgement from the server that our inputs here have been accepted
                //and that we can predict from this known position instead

                    //remove the rest of the inputs we have confirmed on the server
                const number_to_clear = Math.abs(lastinputseq_index - (-1));
                core.players.self.inputs.splice(0, number_to_clear);
                    //The player is now located at the new server position, authoritive server
                core.players.self.cur_state.pos = pos(my_server_pos);
                core.players.self.last_input_seq = lastinputseq_index;
                    //Now we reapply all the inputs that we have locally that
                    //the server hasn't yet confirmed. This will 'keep' our position the same,
                    //but also confirm the server position at the same time.
                client_update_physics(core);
                client_update_local_position(core);

            } // if (lastinputseq_index != -1)
        } //if my_last_input_on_server
}


function client_update_physics (core) {
    // Fetch the new direction from the input buffer,
    // and apply it to the state so we can smooth it in the visual state
    if (core.client_predict) {
        core.players.self.old_state.pos = pos(core.players.self.cur_state.pos );
        const nd = process_input(core, core.players.self);
        core.players.self.cur_state.pos = v_add(core.players.self.old_state.pos, nd);
        core.players.self.state_time = core.local_time;
    }
}


function client_process_net_updates (core) {
    // No updates...
    if (!core.server_updates.length)
        return;

    //First : Find the position in the updates, on the timeline
    //We call this current_time, then we find the past_pos and the target_pos using this,
    //searching throught the server_updates array for current_time in between 2 other times.
    // Then :  other player position = lerp ( past_pos, target_pos, current_time );

        //Find the position in the timeline of updates we stored.
    var current_time = core.client_time;
    var count = core.server_updates.length-1;
    var target = null;
    var previous = null;

        //We look from the 'oldest' updates, since the newest ones
        //are at the end (list.length-1 for example). This will be expensive
        //only when our time is not found on the timeline, since it will run all
        //samples. Usually this iterates very little before breaking out with a target.
    for (var i = 0; i < count; ++i) {

        var point = core.server_updates[i];
        var next_point = core.server_updates[i+1];

            //Compare our point in time with the server times we have
        if (current_time > point.t && current_time < next_point.t) {
            target = next_point;
            previous = point;
            break;
        }
    }

        //With no target we store the last known
        //server position and move to that instead
    if (!target) {
        target = core.server_updates[0];
        previous = core.server_updates[0];
    }

    //Now that we have a target and a previous destination,
    //We can interpolate between then based on 'how far in between' we are.
    //This is simple percentage maths, value/target = [0,1] range of numbers.
    //lerp requires the 0,1 value to lerp to? thats the one.

     if (target && previous) {

        core.target_time = target.t;

        var difference = core.target_time - current_time;
        var max_difference = fixed(target.t - previous.t);
        var time_point = fixed(difference/max_difference);

            //Because we use the same target and previous in extreme cases
            //It is possible to get incorrect values due to division by 0 difference
            //and such. This is a safe guard and should probably not be here. lol.
        if ( isNaN(time_point) ) time_point = 0;
        if (time_point == -Infinity) time_point = 0;
        if (time_point == Infinity) time_point = 0;

            //The most recent server update
        const latest_server_data = core.server_updates[ core.server_updates.length-1 ];

            //These are the exact server positions from this tick, but only for the ghost
        var other_server_pos = core.players.self.host ? latest_server_data.cp : latest_server_data.hp;

        // The other players positions in this timeline, behind us and in front of us
        var other_target_pos = core.players.self.host ? target.cp : target.hp;
        var other_past_pos = core.players.self.host ? previous.cp : previous.hp;

        // update the dest block, this is a simple lerp
        // to the target from the previous point in the server_updates buffer
        core.ghosts.server_pos_other.pos = pos(other_server_pos);
        core.ghosts.pos_other.pos = v_lerp(other_past_pos, other_target_pos, time_point);

        if (core.client_smoothing)
            core.players.other.pos = v_lerp( core.players.other.pos, core.ghosts.pos_other.pos, core._pdt*core.client_smooth);
        else
            core.players.other.pos = pos(core.ghosts.pos_other.pos);

            //Now, if not predicting client movement , we will maintain the local player position
            //using the same method, smoothing the players information from the past.
        if (!core.client_predict && !core.naive_approach) {

                //These are the exact server positions from this tick, but only for the ghost
            var my_server_pos = core.players.self.host ? latest_server_data.hp : latest_server_data.cp;

                //The other players positions in this timeline, behind us and in front of us
            var my_target_pos = core.players.self.host ? target.hp : target.cp;
            var my_past_pos = core.players.self.host ? previous.hp : previous.cp;

                //Snap the ghost to the new server position
            core.ghosts.server_pos_self.pos = pos(my_server_pos);
            var local_target = v_lerp(my_past_pos, my_target_pos, time_point);

                //Smoothly follow the destination position
            if (core.client_smoothing)
                core.players.self.pos = v_lerp( core.players.self.pos, local_target, core._pdt*core.client_smooth);
            else
                core.players.self.pos = pos( local_target );
        }

    } //if target && previous
}


function client_update_local_position (core) {
	 if (core.client_predict) {
	    //Work out the time we have since we updated the state
	    var t = (core.local_time - core.players.self.state_time) / core._pdt;

	    //Then store the states for clarity,
	    var old_state = core.players.self.old_state.pos;
	    var current_state = core.players.self.cur_state.pos;

	    //Make sure the visual position matches the states we have stored
	    //core.players.self.pos = v_add( old_state, core.v_mul_scalar( core.v_sub(current_state,old_state), t )  );
	    core.players.self.pos = current_state;
	    
	    //We handle collision on client if predicting.
	    check_collision(core.players.self);
    }
}


function client_refresh_fps (core) {
    // We store the fps for 10 frames, by adding it to this accumulator
    core.fps = 1/core.dt;
    core.fps_avg_acc += core.fps;
    core.fps_avg_count++;

    // When we reach 10 frames we work out the average fps
    if (core.fps_avg_count >= 10) {
        core.fps_avg = core.fps_avg_acc/10;
        core.fps_avg_count = 1;
        core.fps_avg_acc = core.fps;
    } // reached 10 frames
}


function drawPlayer (player) {
    const game = player.game;

    // Set the color for this player
    game.ctx.fillStyle = player.color;

    // Draw a rectangle for us
    game.ctx.fillRect(player.pos.x - player.size.hx, player.pos.y - player.size.hy, player.size.x, player.size.y);

    // Draw a status update
    game.ctx.fillStyle = player.info_color;
    game.ctx.fillText(player.state, player.pos.x+10, player.pos.y + 4);
}


// Main update loop
function update (core, t) {
    // Work out the delta time
    core.dt = core.lastframetime ? fixed( (t - core.lastframetime)/1000.0) : 0.016;

    const currTime = Date.now();

    // Update the game specifics and schedule the next update
    // Clear the screen area
    core.ctx.clearRect(0, 0, 720, 480);

    // draw help/information if required
    client_draw_info(core);

    // Capture inputs from the player
    client_handle_input(core);

    // Network player just gets drawn normally, with interpolation from
    // the server updates, smoothing out the positions from the past.
    // Note that if we don't have prediction enabled - this will also
    // update the actual local client position on screen as well.
    if (!core.naive_approach)
        client_process_net_updates(core);

    // Now they should have updated, we can draw the entity
    drawPlayer(core.players.other);

    // When we are doing client side prediction, we smooth out our position
    // across frames using local input states we have stored.
    client_update_local_position(core);

    // And then we finally draw
    drawPlayer(core.players.self);

    // and these
    if (core.show_dest_pos && !core.naive_approach)
        core.ghosts.pos_other.draw();

    // and lastly draw these
    if (core.show_server_pos && !core.naive_approach) {
        core.ghosts.server_pos_self.draw();
        core.ghosts.server_pos_other.draw();
    }

    // Work out the fps average
    client_refresh_fps(core);

    core.updateid = window.requestAnimationFrame(function (t) { update(core, t); });
    
    core.lastframetime = t;
}


function client_create_debug_gui (core) {

    core.gui = new dat.GUI();

    const _playersettings = core.gui.addFolder('Your settings');

    core.colorcontrol = _playersettings.addColor(core, 'color');

    //We want to know when we change our color so we can tell
    //the server to tell the other clients for us
    core.colorcontrol.onChange(function (value) {
        core.players.self.color = value;
        localStorage.setItem('color', value);
        core.socket.send('c.' + value);
    });

    _playersettings.open();

    const _othersettings = core.gui.addFolder('Methods');

    _othersettings.add(core, 'naive_approach').listen();
    _othersettings.add(core, 'client_smoothing').listen();
    _othersettings.add(core, 'client_smooth').listen();
    _othersettings.add(core, 'client_predict').listen();

    const _debugsettings = core.gui.addFolder('Debug view');
        
    _debugsettings.add(core, 'show_help').listen();
    _debugsettings.add(core, 'fps_avg').listen();
    _debugsettings.add(core, 'show_server_pos').listen();
    _debugsettings.add(core, 'show_dest_pos').listen();
    _debugsettings.add(core, 'local_time').listen();

    _debugsettings.open();

    const _consettings = core.gui.addFolder('Connection');
    _consettings.add(core, 'net_latency').step(0.001).listen();
    _consettings.add(core, 'net_ping').step(0.001).listen();

    //When adding fake lag, we need to tell the server about it.
    const lag_control = _consettings.add(core, 'fake_lag').step(0.001).listen();
    lag_control.onChange(function (value) {
        core.socket.send('l.' + value);
    });

    _consettings.open();

    const _netsettings = core.gui.addFolder('Networking');

    _netsettings.add(core, 'net_offset').min(0.01).step(0.001).listen();
    _netsettings.add(core, 'server_time').step(0.001).listen();
    _netsettings.add(core, 'client_time').step(0.001).listen();
    //_netsettings.add(core, 'oldest_tick').step(0.001).listen();

    _netsettings.open();
}


function client_create_configuration (core) {
    core.show_help = false;             //Whether or not to draw the help text
    core.naive_approach = false;        //Whether or not to use the naive approach
    core.show_server_pos = false;       //Whether or not to show the server position
    core.show_dest_pos = false;         //Whether or not to show the interpolation goal
    core.client_predict = true;         //Whether or not the client is predicting input
    core.input_seq = 0;                 //When predicting client inputs, we store the last input as a sequence number
    core.client_smoothing = true;       //Whether or not the client side prediction tries to smooth things out
    core.client_smooth = 25;            //amount of smoothing to apply to client update dest

    core.net_latency = 0.001;           //the latency between the client and the server (ping/2)
    core.net_ping = 0.001;              //The round trip time from here to the server,and back
    core.last_ping_time = 0.001;        //The time we last sent a ping
    core.fake_lag = 0;                  //If we are simulating lag, this applies only to the input client (not others)
    core.fake_lag_time = 0;

    core.net_offset = 100;              //100 ms latency between server and client interpolation for other clients
    core.buffer_size = 2;               //The size of the server history to keep for rewinding/interpolating.
    core.target_time = 0.01;            //the time where we want to be in the server timeline
    core.oldest_tick = 0.01;            //the last time tick we have available in the buffer

    core.client_time = 0.01;            //Our local 'clock' based on server time - client interpolation(net_offset).
    core.server_time = 0.01;            //The time the server reported it was at, last we heard from it
    
    core.dt = 0.016;                    //The time that the last frame took to run
    core.fps = 0;                       //The current instantaneous fps (1/core.dt)
    core.fps_avg_count = 0;             //The number of samples we have taken for fps_avg
    core.fps_avg = 0;                   //The current average fps displayed in the debug UI
    core.fps_avg_acc = 0;               //The accumulation of the last avgcount fps samples

    //core.lit = 0;
    //core.llt = new Date().getTime();
}


function client_create_ping_timer (core) {
    // Set a ping timer to 1 second, to maintain the ping/latency between
    // client and server and calculated roughly how our connection is doing
    setInterval(function () {
        core.last_ping_time = new Date().getTime() - core.fake_lag;
        core.socket.send('p.' + (core.last_ping_time) );

    }, 1000);
}


function client_connect_to_server (core) {  
    // Store a local reference to our connection to the server
    core.socket = io.connect();

    // When we connect, we are not 'connected' until we have a server id
    // and are placed in a game by the server. The server sends us a message for that.
    core.socket.on('connect', function () {
        core.players.self.state = 'connecting';
    });

    // Sent when we are disconnected (network, server down, etc)
    core.socket.on('disconnect', function (data) {
        client_ondisconnect(core, data)
    });

    // Sent each tick of the server simulation. This is our authoritive update
    core.socket.on('onserverupdate', function (data) {
        client_onserverupdate_recieved(data, core);
    });

    // Handle when we connect to the server, showing state and storing id's.
    core.socket.on('onconnected', function (data) {
        client_onconnected(core, data);
    });

    // On error we just show that we are not connected for now. Can print the data.
    core.socket.on('error', function (data) {
        client_ondisconnect(core, data)
    });

    // On message from the server, we parse the commands and send it to the handlers
    core.socket.on('message', function (data) {
        client_onnetmessage(core, data);
    });
}


function client_onserverupdate_recieved (data, core) {
    //Lets clarify the information we have locally. One of the players is 'hosting' and
    //the other is a joined in client, so we name these host and client for making sure
    //the positions we get from the server are mapped onto the correct local sprites
    const player_host = core.players.self.host ?  core.players.self : core.players.other;
    const player_client = core.players.self.host ?  core.players.other : core.players.self;
    const this_player = core.players.self;
        
    //Store the server time (this is offset by the latency in the network, by the time we get it)
    core.server_time = data.t;
    //Update our local offset time from the last server update
    core.client_time = core.server_time - (core.net_offset/1000);

    //One approach is to set the position directly as the server tells you.
    //This is a common mistake and causes somewhat playable results on a local LAN, for example,
    //but causes terrible lag when any ping/latency is introduced. The player can not deduce any
    //information to interpolate with so it misses positions, and packet loss destroys this approach
    //even more so. See 'the bouncing ball problem' on Wikipedia.

    if (core.naive_approach) {
        if (data.hp)
            player_host.pos = pos(data.hp);

        if (data.cp)
            player_client.pos = pos(data.cp);

    } else {
        //Cache the data from the server,
        //and then play the timeline
        //back to the player with a small delay (net_offset), allowing
        //interpolation between the points.
        core.server_updates.push(data);

        //we limit the buffer in seconds worth of updates
        //60fps*buffer seconds = number of samples
        if (core.server_updates.length >= ( 60*core.buffer_size ))
            core.server_updates.splice(0,1);

        //We can see when the last tick we know of happened.
        //If client_time gets behind this due to latency, a snap occurs
        //to the last tick. Unavoidable, and a reallly bad connection here.
        //If that happens it might be best to drop the game after a period of time.
        core.oldest_tick = core.server_updates[0].t;

        //Handle the latest positions from the server
        //and make sure to correct our local predictions, making the server have final say.
        client_process_net_prediction_correction(core);     
    }
}


function client_reset_positions (core) {

    var player_host = core.players.self.host ?  core.players.self : core.players.other;
    var player_client = core.players.self.host ?  core.players.other : core.players.self;

        //Host always spawns at the top left.
    player_host.pos = { x: 20, y: 20 };
    player_client.pos = { x: 500, y: 200 };

        //Make sure the local player physics is updated
    core.players.self.old_state.pos = pos(core.players.self.pos);
    core.players.self.pos = pos(core.players.self.pos);
    core.players.self.cur_state.pos = pos(core.players.self.pos);

        //Position all debug view items to their owners position
    core.ghosts.server_pos_self.pos = pos(core.players.self.pos);

    core.ghosts.server_pos_other.pos = pos(core.players.other.pos);
    core.ghosts.pos_other.pos = pos(core.players.other.pos);
}


function client_onreadygame (core, data) {

    var server_time = parseFloat(data.replace('-','.'));

    var player_host = core.players.self.host ?  core.players.self : core.players.other;
    var player_client = core.players.self.host ?  core.players.other : core.players.self;

    core.local_time = server_time + core.net_latency;
    console.log('server time is about ' + core.local_time);

        //Store their info colors for clarity. server is always blue
    player_host.info_color = '#2288cc';
    player_client.info_color = '#cc8822';
        
        //Update their information
    player_host.state = 'local_pos(hosting)';
    player_client.state = 'local_pos(joined)';

    core.players.self.state = 'YOU ' + core.players.self.state;

        //Make sure colors are synced up
     core.socket.send('c.' + core.players.self.color);
}


function client_onjoingame (core, data) {
        //We are not the host
    core.players.self.host = false;
        //Update the local state
    core.players.self.state = 'connected.joined.waiting';
    core.players.self.info_color = '#00bb00';

        //Make sure the positions match servers and other clients
    client_reset_positions(core);
}


function client_onhostgame (core, data) {
        //The server sends the time when asking us to host, but it should be a new game.
        //so the value will be really small anyway (15 or 16ms)
    var server_time = parseFloat(data.replace('-','.'));

        //Get an estimate of the current time on the server
    core.local_time = server_time + core.net_latency;

        //Set the flag that we are hosting, this helps us position respawns correctly
    core.players.self.host = true;

        //Update debugging information to display state
    core.players.self.state = 'hosting.waiting for a player';
    core.players.self.info_color = '#cc0000';

        //Make sure we start in the correct place as the host.
    client_reset_positions(core);
}


function client_onconnected (core, data) {
    //The server responded that we are now in a game,
    //this lets us store the information about ourselves and set the colors
    //to show we are now ready to be playing.
    core.players.self.id = data.id;
    core.players.self.info_color = '#cc0000';
    core.players.self.state = 'connected';
    core.players.self.online = true;
}


function client_on_otherclientcolorchange (core, data) {
    core.players.other.color = data;
}


function client_onping (core, data) {
    core.net_ping = new Date().getTime() - parseFloat( data );
    core.net_latency = core.net_ping/2;
}


function client_onnetmessage (core, data) {
    var commands = data.split('.');
    var command = commands[0];
    var subcommand = commands[1] || null;
    var commanddata = commands[2] || null;

    switch(command) {
        case 's': // server message
            switch(subcommand) {

                case 'h' : //host a game requested
                    client_onhostgame(core, commanddata); break;

                case 'j' : //join a game requested
                    client_onjoingame(core, commanddata); break;

                case 'r' : //ready a game requested
                    client_onreadygame(core, commanddata); break;

                case 'e' : //end game requested
                    client_ondisconnect(core, commanddata); break;

                case 'p' : //server ping
                    client_onping(core, commanddata); break;

                case 'c' : //other player changed colors
                    client_on_otherclientcolorchange(core, commanddata); break;

            } // subcommand

        break; //'s'
    } // command    
}


function client_ondisconnect (core, data) {
    // When we disconnect, we don't know if the other player is
    // connected or not, and since we aren't, everything goes to offline

    core.players.self.info_color = 'rgba(255,255,255,0.1)';
    core.players.self.state = 'not-connected';
    core.players.self.online = false;

    core.players.other.info_color = 'rgba(255,255,255,0.1)';
    core.players.other.state = 'not-connected';
}


/*
function createClient (core) {
	return {
		ghosts: {
	        // Our ghost position on the server
	        server_pos_self: undefined,
	        // The other players server position as we receive it
	        server_pos_other : undefined,
	        // The other players ghost destination position (the lerp)
	        pos_other : undefined
	    },

	    keyboard: new THREEx.KeyboardState(),

	    // A list of recent server updates we interpolate across
	    // This is the buffer that is the driving factor for our networking
	    server_updates: [ ],

	    // Set their colors from the storage or locally
	    color: '#cc8822', //localStorage.getItem('color') || '#cc8822'

	    socket: undefined,
	    ctx: undefined,
	    gui: undefined,
	    colorcontrol: undefined,

	    show_help: false,             //Whether or not to draw the help text
	    naive_approach: false,        //Whether or not to use the naive approach
	    show_server_pos: false,       //Whether or not to show the server position
	    show_dest_pos: false,         //Whether or not to show the interpolation goal
	    client_predict: true,         //Whether or not the client is predicting input
	    input_seq: 0,                 //When predicting client inputs, we store the last input as a sequence number
	    client_smoothing: true,       //Whether or not the client side prediction tries to smooth things out
	    client_smooth: 25,            //amount of smoothing to apply to client update dest

	    net_latency: 0.001,           //the latency between the client and the server (ping/2)
	    net_ping: 0.001,              //The round trip time from here to the server,and back
	    last_ping_time: 0.001,        //The time we last sent a ping
	    fake_lag: 0,                //If we are simulating lag, this applies only to the input client (not others)
	    fake_lag_time: 0,

	    net_offset: 100,              //100 ms latency between server and client interpolation for other clients
	    buffer_size: 2,               //The size of the server history to keep for rewinding/interpolating.
	    target_time: 0.01,            //the time where we want to be in the server timeline
	    oldest_tick: 0.01,            //the last time tick we have available in the buffer

	    client_time: 0.01,            //Our local 'clock' based on server time - client interpolation(net_offset).
	    server_time: 0.01,            //The time the server reported it was at, last we heard from it
	    
	    dt: 0.016,                    //The time that the last frame took to run
	    fps: 0,                       //The current instantaneous fps (1/this.dt)
	    fps_avg_count: 0,             //The number of samples we have taken for fps_avg
	    fps_avg: 0,                   //The current average fps displayed in the debug UI
	    fps_avg_acc: 0,               //The accumulation of the last avgcount fps samples

	    //lit: 0,
	    //llt: new Date().getTime(),

	    client_has_input: false
	};

	// Debugging ghosts, to help visualise things
    core.ghosts = {
        // Our ghost position on the server
        server_pos_self : new game_player(core),
        // The other players server position as we receive it
        server_pos_other : new game_player(core),
        // The other players ghost destination position (the lerp)
        pos_other : new game_player(core)
    };

    core.ghosts.pos_other.state = 'dest_pos';

    core.ghosts.pos_other.info_color = 'rgba(255,255,255,0.1)';

    core.ghosts.server_pos_self.info_color = 'rgba(255,255,255,0.2)';
    core.ghosts.server_pos_other.info_color = 'rgba(255,255,255,0.2)';

    core.ghosts.server_pos_self.state = 'server_pos';
    core.ghosts.server_pos_other.state = 'server_pos';

    core.ghosts.server_pos_self.pos = { x:20, y:20 };
    core.ghosts.pos_other.pos = { x:500, y:200 };
    core.ghosts.server_pos_other.pos = { x:500, y:200 };
}


this.players = {
            self : new game_player(this),
            other : new game_player(this)
        };

        // Debugging ghosts, to help visualise things
        this.ghosts = {
            // Our ghost position on the server
            server_pos_self : new game_player(this),
            // The other players server position as we receive it
            server_pos_other : new game_player(this),
            // The other players ghost destination position (the lerp)
            pos_other : new game_player(this)
        };

        this.ghosts.pos_other.state = 'dest_pos';

        this.ghosts.pos_other.info_color = 'rgba(255,255,255,0.1)';

        this.ghosts.server_pos_self.info_color = 'rgba(255,255,255,0.2)';
        this.ghosts.server_pos_other.info_color = 'rgba(255,255,255,0.2)';

        this.ghosts.server_pos_self.state = 'server_pos';
        this.ghosts.server_pos_other.state = 'server_pos';

        this.ghosts.server_pos_self.pos = { x:20, y:20 };
        this.ghosts.pos_other.pos = { x:500, y:200 };
        this.ghosts.server_pos_other.pos = { x:500, y:200 };
*/


// When loading, we store references to our drawing canvases, and initiate a game instance.
window.onload = function () {

	// Create our game client instance.
	const game = gameCore.create();

	// Create a keyboard handler
    game.keyboard = new THREEx.KeyboardState();

    // Create the default configuration settings
    client_create_configuration(game);

    // A list of recent server updates we interpolate across
    // This is the buffer that is the driving factor for our networking
    game.server_updates = [ ];

    // Start a fast paced timer for measuring time easier
    setInterval(function () {
        game._dt = new Date().getTime() - game._dte;
        game._dte = new Date().getTime();
        game.local_time += game._dt / 1000.0;
    }, 4);

    // Connect to the socket.io server!
    client_connect_to_server(game);

    // We start pinging the server to determine latency
    client_create_ping_timer(game);

    // Set their colors from the storage or locally
    game.color = localStorage.getItem('color') || '#cc8822' ;
    localStorage.setItem('color', game.color);
    game.players.self.color = game.color;

	// Make this only if requested
    if (String(window.location).indexOf('debug') != -1)
        client_create_debug_gui(game);

	// Fetch the viewport
	const viewport = document.getElementById('viewport');
		
	// Adjust their size
	viewport.width = game.world.width;
	viewport.height = game.world.height;

	// Fetch the rendering contexts
	game.ctx = viewport.getContext('2d');

	// Set the draw style for the font
	game.ctx.font = '11px "Helvetica"';

	// Start a physics loop, this is separate to the rendering
    // as this happens at a fixed frequency
    setInterval(function () {
    	game._pdt = (new Date().getTime() - game._pdte)/1000.0;
	    game._pdte = new Date().getTime();
	    client_update_physics(game);
    }, 15);

	// start the loop
	update(game, new Date().getTime());
};
