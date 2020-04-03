/*  Copyright 2012-2016 Sven "underscorediscovery" Bergström
    
    written by : http://underscorediscovery.ca
    written for : http://buildnewgames.com/real-time-multiplayer/
    
    MIT Licensed.
*/

import game_player from './game-player.js';


// Now the main game class. This gets created on
// both server and client. Server creates one for
// each game that is hosted, and client creates one
// for itself to play the game.

function create (game_instance) {
    const core = {
        instance: game_instance,

        // Store a flag if we are the server
        server: game_instance !== undefined, 

        // Used in collision etc.
        world: {
            width : 720,
            height : 480
        },

        players: {
            self : undefined,
            other : undefined
        },

        // The speed at which the clients move.
        playerspeed: 120,

        // run the local game at 16ms, 60hz. on server we run at 45ms, 22hz
        frame_time: ('undefined' != typeof(global)) ? 45 : 60 / 1000,
        lastframetime: 0,

        // Set up some physics integration values
        _pdt: 0.0001,                // The physics update delta time
        _pdte: new Date().getTime(), // The physics update last delta time
        
        // A local timer for precision on server and client
        local_time: 0.016,           // The local timer
        _dt: new Date().getTime(),   // The local timer delta
        _dte: new Date().getTime(),   // The local timer last frame time

        // this is the result of calling requestAnimationFrame or setTmeout (handle to next update callback)
        // can be used to cancel/stop the update loop
        updateid: undefined
    };

    // create a player set, passing them the game that is running them, as well
    if (core.server) {
        core.players = {
            self: new game_player(core, core.instance.player_host),
            other: new game_player(core, core.instance.player_client)
        };

       core.players.self.pos = { x: 20, y: 20 };

    } else {
        core.players = {
            self : new game_player(core),
            other : new game_player(core)
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

    return core;
}


export default { create };
