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
        isServer, 

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
        
        // timer for precision on server and client
        network_time: 0.0,

        // this is the result of calling requestAnimationFrame or setTmeout (handle to next update callback)
        // can be used to cancel/stop the update loop
        updateid: undefined
    };
}


export default { create };
