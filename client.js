/*  Copyright 2012-2016 Sven "underscorediscovery" Bergström

written by : http://underscorediscovery.ca
written for : http://buildnewgames.com/real-time-multiplayer/

MIT Licensed.
*/
import gameCore from './game.core.js';


// A window global for our game root variable.
//var game = { };

// When loading, we store references to our drawing canvases, and initiate a game instance.
window.onload = function () {

	// Create our game client instance.
	const game = new gameCore.create();

	// Fetch the viewport
	const viewport = document.getElementById('viewport');
		
	// Adjust their size
	viewport.width = game.world.width;
	viewport.height = game.world.height;

	// Fetch the rendering contexts
	game.ctx = viewport.getContext('2d');

	// Set the draw style for the font
	game.ctx.font = '11px "Helvetica"';

	// start the loop
	gameCore.update(game, new Date().getTime());
};
