/*  Copyright 2012-2016 Sven "underscorediscovery" Bergström
    
    written by : http://underscorediscovery.ca
    written for : http://buildnewgames.com/real-time-multiplayer/
    
    MIT Licensed.
*/

import check_collision from './check-collision.js';
import fixed           from './lib/fixed.js';
import game_player     from './game-player.js';
import pos             from './lib/pos.js';
import process_input   from './process-input.js';
import v_add           from './lib/v-add.js';


// Now the main game class. This gets created on
// both server and client. Server creates one for
// each game that is hosted, and client creates one
// for itself to play the game.

function create (game_instance) {
    // TODO: move code from game_core_model.js here

    // Store the instance, if any
    this.instance = game_instance;
    // Store a flag if we are the server
    this.server = this.instance !== undefined;

    // Used in collision etc.
    this.world = {
        width : 720,
        height : 480
    };

    // We create a player set, passing them
    // the game that is running them, as well
    if (this.server) {

        this.players = {
            self : new game_player(this, this.instance.player_host),
            other : new game_player(this, this.instance.player_client)
        };

       this.players.self.pos = {x:20,y:20};

    } else {

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
    }

    // The speed at which the clients move.
    this.playerspeed = 120;

    // Set up some physics integration values
    this._pdt = 0.0001;                 // The physics update delta time
    this._pdte = new Date().getTime();  // The physics update last delta time
    // A local timer for precision on server and client
    this.local_time = 0.016;            // The local timer
    this._dt = new Date().getTime();    // The local timer delta
    this._dte = new Date().getTime();   // The local timer last frame time

    // Server specific initialisation
    if (this.server) {
        // Start a fast paced timer for measuring time easier
        create_timer(this);

        // Start a physics loop, this is separate to the rendering
        // as this happens at a fixed frequency
        setInterval(update_physics, 15, this);

        this.server_time = 0;
        this.laststate = { };
    }

}; //game_core.constructor


function stop_update (core) {
    if (core.server)
        clearTimeout(core.updateid);
    else
        window.cancelAnimationFrame(core.updateid);
}


// run the local game at 16ms, 60hz. on server we run at 45ms, 22hz
const frame_time = ('undefined' != typeof(global)) ? 45 : 60 / 1000;


// Main server update loop
function update (core, t) {
    // Work out the delta time
    core.dt = core.lastframetime ? fixed( (t - core.lastframetime)/1000.0) : 0.016;

    const currTime = Date.now();

    // Update the game specifics and schedule the next update
    if (core.server) {
        server_update(core);
        const timeToCall = Math.max( 0, frame_time - ( currTime - (core.lastframetime || 0) ) );
        core.updateid = setTimeout(update, timeToCall, core, currTime + timeToCall);
    }

    core.lastframetime = t;
}


function update_physics (core) {
    core._pdt = (new Date().getTime() - core._pdte)/1000.0;
    core._pdte = new Date().getTime();
    server_update_physics(core);
}


// Updated at 15ms, simulates the world state
function server_update_physics (core) {

    // Handle player one
    core.players.self.old_state.pos = pos( core.players.self.pos );
    const new_dir = process_input(core, core.players.self);
    core.players.self.pos = v_add( core.players.self.old_state.pos, new_dir );

    // Handle player two
    core.players.other.old_state.pos = pos( core.players.other.pos );
    const other_new_dir = process_input(core, core.players.other);
    core.players.other.pos = v_add( core.players.other.old_state.pos, other_new_dir);

    // Keep the physics position in the world
    check_collision(core.players.self);
    check_collision(core.players.other);

    core.players.self.inputs = [ ];  // we have cleared the input buffer, so remove this
    core.players.other.inputs = [ ]; // we have cleared the input buffer, so remove this
}


// Makes sure things run smoothly and notifies clients of changes
// on the server side
function server_update (core) {

    // Update the state of our local clock to match the timer
    core.server_time = core.local_time;

    // Make a snapshot of the current state, for updating the clients
    core.laststate = {
        hp  : core.players.self.pos,              // 'host position', the game creators position
        cp  : core.players.other.pos,             // 'client position', the person that joined, their position
        his : core.players.self.last_input_seq,   // 'host input sequence', the last input we processed for the host
        cis : core.players.other.last_input_seq,  // 'client input sequence', the last input we processed for the client
        t   : core.server_time                    // our current local time on the server
    };

    // Send the snapshot to the 'host' player
    if (core.players.self.instance)
        core.players.self.instance.emit( 'onserverupdate', core.laststate );

    // Send the snapshot to the 'client' player
    if (core.players.other.instance)
        core.players.other.instance.emit( 'onserverupdate', core.laststate );
}


function handle_server_input (core, client, input, input_time, input_seq) {

    // Fetch which client this refers to out of the two
    const player_client =
        (client.userid == core.players.self.instance.userid) ?
            core.players.self : core.players.other;

    // Store the input on the player instance for processing in the physics loop
    player_client.inputs.push({ inputs: input, time: input_time, seq: input_seq });
}


function create_timer (core) {
    setInterval(function () {
        core._dt = new Date().getTime() - core._dte;
        core._dte = new Date().getTime();
        core.local_time += core._dt / 1000.0;
    }, 4);
}


export default { create, handle_server_input, stop_update, update };
