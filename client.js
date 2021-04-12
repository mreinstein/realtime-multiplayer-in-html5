/*  Copyright 2012-2016 Sven "underscorediscovery" Bergström

written by : http://underscorediscovery.ca
written for : http://buildnewgames.com/real-time-multiplayer/

MIT Licensed.
*/
import ECS                      from 'https://cdn.skypack.dev/ecs';
import Renderer                 from './Renderer.js';
import createNetClientComponent from './component-net-client.js';
import dat                      from 'https://cdn.skypack.dev/dat.gui';
import gameCore                 from './game.core.js';
import game_player              from './game-player.js';
import inputSystem              from './system-input.js';
import movementSystem           from './system-movement.js';
import netClientSystem          from './system-net-client.js';
import rendererSystem           from './system-renderer.js';
import { PHYSICS_FRAME_TICK }   from './constants.js';


function create_debug_gui (client, core) {

    const gui = new dat.GUI();

    const _playersettings = gui.addFolder('Your settings');

    const colorcontrol = _playersettings.addColor(core, 'color');

    // We want to know when we change our color so we can tell
    // the server to tell the other clients for us
    colorcontrol.onChange(function (value) {
        core.players.self.color = value;
        localStorage.setItem('color', value);
        client.socket.send('c.' + value);
    });

    _playersettings.open();

    const _othersettings = gui.addFolder('Methods');

    _othersettings.add(client, 'client_smoothing').listen();
    _othersettings.add(client, 'client_smooth').listen();

    const _debugsettings = gui.addFolder('Debug view');

    _debugsettings.add(core, 'network_time').listen();

    _debugsettings.open();

    const _consettings = gui.addFolder('Connection');
    _consettings.add(client, 'net_latency').step(0.001).listen();
    _consettings.add(client, 'net_ping').step(0.001).listen();

    //When adding fake lag, we need to tell the server about it.
    const lag_control = _consettings.add(client, 'fake_lag').step(0.001).listen();
    lag_control.onChange(function (value) {
        client.socket.send('l.' + value);
    });

    _consettings.open();

    const _netsettings = gui.addFolder('Networking');

    _netsettings.add(client, 'interpolation_offset').min(0.01).step(0.001).listen();
    _netsettings.add(client, 'server_time').step(0.001).listen();
    _netsettings.add(client, 'client_time').step(0.001).listen();
    //_netsettings.add(core, 'oldest_tick').step(0.001).listen();

    _netsettings.open();
}


// When loading, we store references to our drawing canvases, and initiate a game instance.
window.onload = function () {

    const world = ECS.createWorld();

    // Create our game client instance.
    const game = gameCore.create();

    game.players.self = game_player();
    game.players.other = game_player();
    

    const client = createNetClientComponent(game);

    const clientEntity = ECS.createEntity(world);
    ECS.addComponentToEntity(world, clientEntity, 'game_core', game);
    ECS.addComponentToEntity(world, clientEntity, 'net_client', client);
    ECS.addComponentToEntity(world, clientEntity, 'movement');

    ECS.addSystem(world, inputSystem);
    ECS.addSystem(world, movementSystem);
    ECS.addSystem(world, netClientSystem);
    ECS.addSystem(world, rendererSystem);

    // Set player colors from the storage or locally
    game.color = localStorage.getItem('color') || '#cc8822' ;
    localStorage.setItem('color', game.color);
    game.players.self.color = game.color;

	// Make this only if requested
    if (String(window.location).includes('debug'))
        create_debug_gui(client, game);

	const viewport = document.getElementById('viewport');
	viewport.width = game.world.width;
	viewport.height = game.world.height;

	Renderer.ctx = viewport.getContext('2d');
	Renderer.ctx.font = '11px "Helvetica"';

	let currentTime = performance.now(), accumulator = 0;

	// inspired by https://gafferongames.com/post/fix_your_timestep/
	const update = function () {
		const newTime = performance.now();
		const frameTime = newTime - currentTime;
		currentTime = newTime;

        ECS.preUpdate(world, frameTime);

        accumulator += frameTime;

        // reset accumulator when > 2 seconds of time has elapsed since last step
        // e.g., when the game window is restored after being hidden for a while
        if (accumulator > 2000)
            accumulator = 0

		while (accumulator >= PHYSICS_FRAME_TICK) {
			accumulator -= PHYSICS_FRAME_TICK;
            ECS.fixedUpdate(world, PHYSICS_FRAME_TICK);
		}

        ECS.update(world, frameTime);

		window.requestAnimationFrame(update);
	};

	update();
};
