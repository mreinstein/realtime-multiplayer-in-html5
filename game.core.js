/*  Copyright 2012-2016 Sven "underscorediscovery" Bergström
    
    written by : http://underscorediscovery.ca
    written for : http://buildnewgames.com/real-time-multiplayer/
    
    MIT Licensed.
*/


// This gets created on both server and client. Server creates one for
// each game that is hosted, and client creates one for itself to play the game.

function create ({ isServer }) {
    return {
        // Store a flag if we are the server
        server: isServer, 

        // Used in collision etc.
        world: {
            width: 720,
            height: 480
        },

        players: {
            self: undefined,
            other: undefined
        },

        // The speed at which the clients move.
        playerspeed: 120,

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
}


export default { create };
