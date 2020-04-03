/*  Copyright 2012-2016 Sven "underscorediscovery" Bergström

written by : http://underscorediscovery.ca
written for : http://buildnewgames.com/real-time-multiplayer/

MIT Licensed.
*/
import check_collision from './check-collision.js';
import fixed           from './lib/fixed.js';
import gameCore        from './game.core.js'; // shared game library code
//import { performance } from 'perf_hooks';
import pos             from './lib/pos.js';
import process_input   from './process-input.js';
import v_add           from './lib/v-add.js';
import UUID            from 'node-uuid';


// TODO: make this module fully data oriented

// TODO: combine into a single event loop rather than setting off multiple independent setInterval calls

// TODO: there are several time variables, across the client and core objects.
//       could these be simplified/combined?

const game_server = {
        games : { },
        game_count: 0,

        fake_latency: 0,
        local_time: 0,
        _dt: new Date().getTime(),
        _dte: new Date().getTime(),

        // a local queue of messages we delay if faking latency
        messages: [ ]
    },
    verbose     = true;


// A simple wrapper for logging so we can toggle it,
// and augment it for clarity.
game_server.log = function (...args) {
    if (verbose)
        console.log(...args);
};


setInterval(function () {
    game_server._dt = new Date().getTime() - game_server._dte;
    game_server._dte = new Date().getTime();
    game_server.local_time += game_server._dt / 1000.0;
}, 4);


game_server.onMessage = function (client, message) {
    if (this.fake_latency && message.split('.')[0].substr(0,1) == 'i') {

        // store all input message
        game_server.messages.push({client:client, message:message});

        setTimeout(function () {
            if (game_server.messages.length) {
                game_server._onMessage( game_server.messages[0].client, game_server.messages[0].message );
                game_server.messages.splice(0,1);
            }
        }.bind(this), this.fake_latency);

    } else {
        game_server._onMessage(client, message);
    }
};


game_server._onMessage = function (client, message) {
    // Cut the message up into sub components
    const message_parts = message.split('.');
    // The first is always the type of message
    const message_type = message_parts[0];

    const other_client =
        (client.game.player_host.userid == client.userid) ?
            client.game.player_client : client.game.player_host;

    if (message_type == 'i') {
        // Input handler will forward this
        onInput(client, message_parts);
    } else if (message_type == 'p') {
        client.send('s.p.' + message_parts[1]);
    } else if (message_type == 'c') {    //Client changed their color!
        if (other_client)
            other_client.send('s.c.' + message_parts[1]);
    } else if (message_type == 'l') {    //A client is asking for lag simulation
        this.fake_latency = parseFloat(message_parts[1]);
    }
};



function handle_server_input (core, client, input, input_time, input_seq) {

    // Fetch which client this refers to out of the two
    const player_client =
        (client.userid == core.players.self.instance.userid) ?
            core.players.self : core.players.other;

    // Store the input on the player instance for processing in the physics loop
    player_client.inputs.push({ inputs: input, time: input_time, seq: input_seq });
}


function onInput (client, parts) {
    // The input commands come in like u-l,
    // so we split them up into separate commands,
    // and then update the players
    const input_commands = parts[1].split('-');
    const input_time = parts[2].replace('-', '.');
    const input_seq = parts[3];

    // the client should be in a game, so
    // we can tell that game to handle the input
    if (client && client.game && client.game.gamecore)
        handle_server_input(client.game.gamecore, client, input_commands, input_time, input_seq);
}


function update (server, core, t) {
    // Work out the delta time
    core.dt = server.lastframetime ? fixed( (t - server.lastframetime)/1000.0) : 0.016;

    const currTime = Date.now();

    // Update the game specifics and schedule the next update
    // Makes sure things run smoothly and notifies clients of changes on the server side
    // Update the state of our local clock to match the timer
    server.server_time = core.local_time;

    // Make a snapshot of the current state, for updating the clients
    server.laststate = {
        hp  : core.players.self.pos,              // 'host position', the game creators position
        cp  : core.players.other.pos,             // 'client position', the person that joined, their position
        his : core.players.self.last_input_seq,   // 'host input sequence', the last input we processed for the host
        cis : core.players.other.last_input_seq,  // 'client input sequence', the last input we processed for the client
        t   : server.server_time                    // our current local time on the server
    };

    // Send the snapshot to the 'host' player
    if (core.players.self.instance)
        core.players.self.instance.emit( 'onserverupdate', server.laststate );

    // Send the snapshot to the 'client' player
    if (core.players.other.instance)
        core.players.other.instance.emit( 'onserverupdate', server.laststate );

    const timeToCall = Math.max( 0, server.frame_time - ( currTime - (server.lastframetime || 0) ) );
    core.updateid = setTimeout(update, timeToCall, server, core, currTime + timeToCall);

    server.lastframetime = t;
}


// Define some required functions
game_server.createGame = function (player) {

    // Create a new game instance
    const thegame = {
        id: UUID(),                // generate a new id for the game
        player_host: player,       // so we know who initiated the game
        player_client: undefined,  // nobody else joined yet, since its new
        player_count: 1            // for simple checking of state
    };

    // Store it in the list of game
    this.games[thegame.id] = thegame;

    // Keep track
    this.game_count++;

    // Create a new game core instance, this actually runs the game code like collisions and such.
    const core = gameCore.create(thegame);
    thegame.gamecore = core;

    const server = {
        server_time: 0,
        laststate: { },
        // run the local game at 16ms, 60hz. on server we run at 45ms, 22hz
        frame_time: ('undefined' != typeof(global)) ? 45 : 60 / 1000,
        lastframetime: 0,
    };


    // Start a fast paced timer for measuring time easier
    setInterval(function () {
        core._dt = new Date().getTime() - core._dte;
        core._dte = new Date().getTime();
        core.local_time += core._dt / 1000.0;
    }, 4);

    // tell the player that they are now the host
    // s=server message, h=you are hosting

    player.send('s.h.'+ String(core.local_time).replace('.','-'));
    console.log('server host at  ' + core.local_time);
    player.game = thegame;
    player.hosting = true;
    
    this.log('player ' + player.userid + ' created a game with id ' + player.game.id);

    // Start a physics loop, this is separate to the rendering
    // as this happens at a fixed frequency
    setInterval(function () {
        core._pdt = (new Date().getTime() - core._pdte)/1000.0;

        core._pdte = new Date().getTime();
        // Handle player one
        core.players.self.old_state.pos = pos( core.players.self.pos );
        const new_dir = process_input(core.playerspeed, core.players.self);
        core.players.self.pos = v_add( core.players.self.old_state.pos, new_dir );

        // Handle player two
        core.players.other.old_state.pos = pos( core.players.other.pos );
        const other_new_dir = process_input(core.playerspeed, core.players.other);
        core.players.other.pos = v_add( core.players.other.old_state.pos, other_new_dir);

        // Keep the physics position in the world
        check_collision(core.players.self);
        check_collision(core.players.other);

        core.players.self.inputs = [ ];  // we have cleared the input buffer, so remove this
        core.players.other.inputs = [ ]; // we have cleared the input buffer, so remove this

    }, 15);

    // start the loop
    update(server, core, new Date().getTime());

    return thegame;
};


function stop_update (core) {
    if (core.server)
        clearTimeout(core.updateid);
    else
        window.cancelAnimationFrame(core.updateid);
}


// we are requesting to kill a game in progress.
game_server.endGame = function (gameid, userid) {
    const thegame = this.games[gameid];

    if (thegame) {
        // stop the game updates immediate
        stop_update(thegame.gamecore);

        // if the game has two players, the one is leaving
        if (thegame.player_count > 1) {

            // send the players the message the game is ending
            if (userid == thegame.player_host.userid) {

                // the host left, oh snap. Lets try join another game
                if (thegame.player_client) {
                    // tell them the game is over
                    thegame.player_client.send('s.e');
                    // now look for/create a new game.
                    this.findGame(thegame.player_client);
                }
                
            } else {
                // the other player left, we were hosting
                if (thegame.player_host) {
                    // tell the client the game is ended
                    thegame.player_host.send('s.e');
                    // i am no longer hosting, this game is going down
                    thegame.player_host.hosting = false;
                    // now look for/create a new game.
                    this.findGame(thegame.player_host);
                }
            }
        }

        delete this.games[gameid];
        this.game_count--;

        this.log('game removed. there are now ' + this.game_count + ' games' );

    } else {
        this.log('that game was not found!');
    }
};


game_server.startGame = function (game) {
    // right so a game has 2 players and wants to begin
    // the host already knows they are hosting,
    // tell the other client they are joining a game
    // s=server message, j=you are joining, send them the host id
    game.player_client.send('s.j.' + game.player_host.userid);
    game.player_client.game = game;

    // now we tell both that the game is ready to start
    // clients will reset their positions in this case.
    game.player_client.send('s.r.'+ String(game.gamecore.local_time).replace('.','-'));
    game.player_host.send('s.r.'+ String(game.gamecore.local_time).replace('.','-'));

    // set this flag, so that the update loop can run it.
    game.active = true;
};


game_server.findGame = function (player) {
    this.log('looking for a game. We have : ' + this.game_count);

    // so there are games active,
    // lets see if one needs another player
    if (this.game_count) {
            
        let joined_a_game = false;

        // Check the list of games for an open game
        for (const gameid in this.games) {
            //only care about our own properties.
            if (!this.games.hasOwnProperty(gameid))
                continue;
            
            // get the game we are checking against
            const game_instance = this.games[gameid];

            // If the game is a player short
            if (game_instance.player_count < 2) {

                // someone wants us to join!
                joined_a_game = true;
                // increase the player count and store
                // the player as the client of this game
                game_instance.player_client = player;
                game_instance.gamecore.players.other.instance = player;
                game_instance.player_count++;

                // start running the game on the server,
                // which will tell them to respawn/start
                this.startGame(game_instance);

            } //if less than 2 players
        } // for all games

        // now if we didn't join a game,
        // we must create one
        if (!joined_a_game)
            this.createGame(player);

    } else {
        // no games? create one!
        this.createGame(player);
    }
};


export default game_server;
