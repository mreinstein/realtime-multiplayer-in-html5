/*  Copyright 2012-2016 Sven "underscorediscovery" Bergström

written by : http://underscorediscovery.ca
written for : http://buildnewgames.com/real-time-multiplayer/

MIT Licensed.
*/

import gameCore from './game.core.js'; // shared game library code
import UUID     from 'node-uuid';


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
        this.onInput(client, message_parts);
    } else if (message_type == 'p') {
        client.send('s.p.' + message_parts[1]);
    } else if (message_type == 'c') {    //Client changed their color!
        if (other_client)
            other_client.send('s.c.' + message_parts[1]);
    } else if (message_type == 'l') {    //A client is asking for lag simulation
        this.fake_latency = parseFloat(message_parts[1]);
    }
};


game_server.onInput = function (client, parts) {
    // The input commands come in like u-l,
    // so we split them up into separate commands,
    // and then update the players
    const input_commands = parts[1].split('-');
    const input_time = parts[2].replace('-', '.');
    const input_seq = parts[3];

    // the client should be in a game, so
    // we can tell that game to handle the input
    if (client && client.game && client.game.gamecore)
        gameCore.handle_server_input(client.game.gamecore, client, input_commands, input_time, input_seq);
};


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
    thegame.gamecore = new gameCore.create(thegame);
    // Start updating the game loop on the server
    gameCore.update(thegame.gamecore, new Date().getTime());

    // tell the player that they are now the host
    // s=server message, h=you are hosting

    player.send('s.h.'+ String(thegame.gamecore.local_time).replace('.','-'));
    console.log('server host at  ' + thegame.gamecore.local_time);
    player.game = thegame;
    player.hosting = true;
    
    this.log('player ' + player.userid + ' created a game with id ' + player.game.id);

    return thegame;
};


// we are requesting to kill a game in progress.
game_server.endGame = function (gameid, userid) {
    const thegame = this.games[gameid];

    if (thegame) {
        // stop the game updates immediate
        gameCore.stop_update(thegame.gamecore);

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
