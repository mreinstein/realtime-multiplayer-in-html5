/*  Copyright 2012-2016 Sven "underscorediscovery" Bergström

written by : http://underscorediscovery.ca
written for : http://buildnewgames.com/real-time-multiplayer/

MIT Licensed.
*/
import checkCollision from './check-collision.js';
import fixed          from './lib/fixed.js';
import gameCore       from './game.core.js'; // shared game library code
import game_player    from './game-player.js';
import pos            from './lib/pos.js';
import processInput  from './process-input.js';
import v_add          from './lib/v-add.js';
import UUID           from 'node-uuid';


// TODO: combine into a single event loop

const VERBOSE = true;
const SERVER_FRAME_TIME = 45; // run the server update every 45ms, 22hz


function createServer () {
    return {
        games : { },
        game_count: 0,
        fake_latency: 0,
        // a local queue of messages we delay if faking latency
        messages: [ ]
    };
}


// only console.log when in verbose mode
function log (...args) {
    if (VERBOSE)
        console.log(...args);
}


function onMessage (game_server, client, message) {
    if (game_server.fake_latency && message.split('.')[0].substr(0,1) == 'i') {

        // store all input message
        game_server.messages.push({ client, message });

        setTimeout(function () {
            if (game_server.messages.length) {
                _onMessage(game_server, game_server.messages[0].client, game_server.messages[0].message );
                game_server.messages.splice(0, 1);
            }
        }, game_server.fake_latency);

    } else {
        _onMessage(game_server, client, message);
    }
}


function _onMessage (game_server, client, message) {
    // Cut the message up into sub components
    const message_parts = message.split('.');
    // The first is always the type of message
    const message_type = message_parts[0];

    const other_client =
        (client.game.hostSocket.userid == client.userid) ?
            client.game.clientSocket : client.game.hostSocket;

    if (message_type == 'i') {
        // Input handler will forward this
        onInput(client, message_parts);
    } else if (message_type == 'p') {
        client.send('s.p.' + message_parts[1]);
    } else if (message_type == 'c') {
        // client changed their color!
        if (other_client)
            other_client.send('s.c.' + message_parts[1]);
    } else if (message_type == 'l') {
        // a client is asking for lag simulation
        game_server.fake_latency = parseFloat(message_parts[1]);
    }
};


function handle_server_input (core, client, input, input_time, input_seq) {

    // Fetch which client this refers to out of the two
    const player_client =
        (client.userid == core.players.self.socket.userid) ?
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
    if (client && client.game && client.game.core)
        handle_server_input(client.game.core, client, input_commands, input_time, input_seq);
}


function update (server, core, t) {
    const currTime = Date.now();

    const dt = (currTime - server.lastUpdateTime) / 1000.0;
    server.lastUpdateTime = currTime;
    
    core.local_time += dt;


    // Make a snapshot of the current state, for updating the clients
    const laststate = {
        hp  : core.players.self.pos,              // 'host position', the game creators position
        cp  : core.players.other.pos,             // 'client position', the person that joined, their position
        his : core.players.self.last_input_seq,   // 'host input sequence', the last input we processed for the host
        cis : core.players.other.last_input_seq,  // 'client input sequence', the last input we processed for the client
        t   : core.local_time                     // our current local time on the server
    };

    // Send the snapshot to the 'host' player
    if (core.players.self.socket)
        core.players.self.socket.emit( 'onserverupdate', laststate );

    // Send the snapshot to the 'client' player
    if (core.players.other.socket)
        core.players.other.socket.emit( 'onserverupdate', laststate );

    const timeToCall = Math.max( 0, SERVER_FRAME_TIME - ( currTime - server.lastFrameTime) );
    core.updateid = setTimeout(update, timeToCall, server, core, currTime + timeToCall);

    server.lastFrameTime = t;
}


// Define some required functions
function createGame (game_server, playerSocket) {
    
    // Create a new game core instance, this actually runs the game code like collisions and such.
    const core = gameCore.create({ isServer: true });

    // Create a new game instance
    const thegame = {
        id: UUID(),                // generate a new id for the game
        hostSocket: playerSocket, // so we know who initiated the game
        clientSocket: undefined,  // nobody else joined yet, since its new
        player_count: 1,           // for simple checking of state
        core
    };

    core.players.self = new game_player(thegame.hostSocket);
    core.players.other = new game_player(thegame.clientSocket);
    core.players.self.pos = { x: 20, y: 20 };


    // Store it in the list of game
    game_server.games[thegame.id] = thegame;

    // Keep track
    game_server.game_count++;

    const server = {
        lastFrameTime: 0,
        lastUpdateTime: 0
    };

    // tell the player that they are now the host
    // s=server message, h=you are hosting

    playerSocket.send('s.h.'+ String(core.local_time).replace('.','-'));
    log('server host at  ' + core.local_time);
    playerSocket.game = thegame;
    //playerSocket.hosting = true;
    
    log('player ' + playerSocket.userid + ' created a game with id ' + thegame.id);

    // Start a physics loop, this is separate to the rendering
    // as this happens at a fixed frequency
    setInterval(function () {
        // Handle player one
        core.players.self.old_state.pos = pos( core.players.self.pos );
        const new_dir = processInput(core.playerspeed, core.players.self);
        core.players.self.pos = v_add( core.players.self.old_state.pos, new_dir );

        // Handle player two
        core.players.other.old_state.pos = pos( core.players.other.pos );
        const other_new_dir = processInput(core.playerspeed, core.players.other);
        core.players.other.pos = v_add( core.players.other.old_state.pos, other_new_dir);

        // Keep the physics position in the world
        checkCollision(core.world, core.players.self);
        checkCollision(core.world, core.players.other);

        core.players.self.inputs = [ ];  // we have cleared the input buffer, so remove this
        core.players.other.inputs = [ ]; // we have cleared the input buffer, so remove this

    }, 15);

    // start the loop
    update(server, core, Date.now());

    return thegame;
}


function stop_update (core) {
    if (core.isServer)
        clearTimeout(core.updateid);
    else
        window.cancelAnimationFrame(core.updateid);
}


// we are requesting to kill a game in progress.
function endGame (game_server, gameid, userid) {
    const thegame = game_server.games[gameid];

    if (thegame) {
        // stop the game updates immediate
        stop_update(thegame.core);

        // if the game has two players, the one is leaving
        if (thegame.player_count > 1) {

            // send the players the message the game is ending
            if (userid == thegame.hostSocket.userid) {

                // the host left, oh snap. Lets try join another game
                if (thegame.clientSocket) {
                    // tell them the game is over
                    thegame.clientSocket.send('s.e');
                    // now look for/create a new game.
                    findGame(game_server, thegame.clientSocket);
                }
                
            } else {
                // the other player left, we were hosting
                if (thegame.hostSocket) {
                    // tell the client the game is ended
                    thegame.hostSocket.send('s.e');
                    // i am no longer hosting, this game is going down
                    //thegame.hostSocket.hosting = false;
                    // now look for/create a new game.
                    findGame(game_server, thegame.hostSocket);
                }
            }
        }

        delete game_server.games[gameid];
        game_server.game_count--;

        log('game removed. there are now ' + game_server.game_count + ' games' );

    } else {
        log('that game was not found!');
    }
}


function startGame (game_server, game) {
    // a game has 2 players and wants to begin
    // the host already knows they are hosting,
    // tell the other client they are joining a game
    // s=server message, j=you are joining, send them the host id
    game.clientSocket.send('s.j.' + game.hostSocket.userid);
    game.clientSocket.game = game;

    // now we tell both that the game is ready to start
    // clients will reset their positions in this case.
    game.clientSocket.send('s.r.'+ String(game.core.local_time).replace('.','-'));
    game.hostSocket.send('s.r.'+ String(game.core.local_time).replace('.','-'));

    // set this flag, so that the update loop can run it.
    game.active = true;
}


function findGame (game_server, playerSocket) {
    log('looking for a game. We have : ' + game_server.game_count);

    // so there are games active,
    // lets see if one needs another player
    if (game_server.game_count) {
            
        let joined_a_game = false;

        // Check the list of games for an open game
        for (const gameid in game_server.games) {
            //only care about our own properties.
            if (!game_server.games.hasOwnProperty(gameid))
                continue;
            
            // get the game we are checking against
            const game_instance = game_server.games[gameid];

            // If the game is a player short
            if (game_instance.player_count < 2) {

                // someone wants us to join!
                joined_a_game = true;
                // increase the player count and store
                // the player as the client of this game
                game_instance.clientSocket = playerSocket;
                game_instance.core.players.other.socket = playerSocket;
                game_instance.player_count++;

                // start running the game on the server,
                // which will tell them to respawn/start
                startGame(game_server, game_instance);

            } //if less than 2 players
        } // for all games

        // now if we didn't join a game,
        // we must create one
        if (!joined_a_game)
            createGame(game_server, playerSocket);

    } else {
        // no games? create one!
        createGame(game_server, playerSocket);
    }
}


export default {
    createServer,
    findGame,
    endGame,
    onMessage
};
