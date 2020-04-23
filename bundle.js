/**
 * Remove a range of items from an array
 *
 * @function removeItems
 * @param {Array<*>} arr The target array
 * @param {number} startIdx The index to begin removing from (inclusive)
 * @param {number} removeCount How many items to remove
 */
function removeItems (arr, startIdx, removeCount) {
  var i, length = arr.length;

  if (startIdx >= length || removeCount <= 0 || startIdx < 0) {
    return
  }

  removeCount = (startIdx + removeCount > length ? length - startIdx : removeCount);

  var len = length - removeCount;

  for (i = startIdx; i < len; ++i) {
    arr[i] = arr[i + removeCount];
  }

  arr.length = len;
}

function createWorld () {
	return {
		entities: [ ],
		filters: { },
		systems: [ ]
	}
}


function createEntity (world) {
	const entity = { };
	world.entities.push(entity);
	return entity
}


function addComponentToEntity (world, entity, componentName, componentData={}) {
	entity[componentName] = componentData;

	// add this entity to any filters that match
	for (const filterId in world.filters) {
		const matches = _matchesFilter(filterId, entity);

		const filter = world.filters[filterId];
		const idx = filter.indexOf(entity);
		if (idx >= 0) {
			// filter already contains entity and the filter doesn't match the entity, remove it
			if (!matches)
				removeItems(filter, idx, 1);
		} else {
			// filter doesn't contain the entity yet, and it's not included yet, add it
			if (matches)
				filter.push(entity);
		}
	}
}


function removeComponentFromEntity (world, entity, componentName) {
	
	delete entity[componentName];

	// remove this entity from any filters that no longer match
	for (const filterId in world.filters) {
		if (filterId.indexOf(componentName) >= 0) {
			// this filter contains the removed component
			const filter = world.filters[filterId];
			const filterIdx = filter.indexOf(entity);
			if (filterIdx >= 0)
				removeItems(filter, filterIdx, 1);
		}
	}
}


function getEntities (world, componentNames) {
	const filterId = componentNames.join(',');
	if (!world.filters[filterId])
		world.filters[filterId] = world.entities.filter((e) => _matchesFilter(filterId, e));

	return world.filters[filterId]
}


// returns true if an entity contains all the components that match the filter
function _matchesFilter (filterId, entity) {
	const componentIds = filterId.split(',');
	// if the entity lacks any components in the filter, it's not in the filter
	for (const componentId of componentIds)
		if (!entity[componentId])
			return false

	return true
}


function removeEntity (world, entity) {
	const idx = world.entities.indexOf(entity);
	if (idx < 0)
		return

	removeItems(world.entities, idx, 1);

	// update all filters that match this
	for (const filterId in world.filters) {
		const filter = world.filters[filterId];
		const idx = filter.indexOf(entity);
		if (idx >= 0)
			removeItems(filter, idx, 1);
	}
}


function addSystem (world, fn) {
	const system = fn(world);
	if (!system.onUpdate)
		system.onUpdate = function () { };

	if (!system.onFixedUpdate)
		system.onFixedUpdate = function () { };

	world.systems.push(system);
}


function fixedUpdate (world, dt) {
	for (const system of world.systems)
		system.onFixedUpdate(dt);
}


function update (world, dt) {
	for (const system of world.systems)
		system.onUpdate(dt);
}


var ECS = { createWorld, createEntity, addComponentToEntity, removeComponentFromEntity, getEntities, removeEntity, addSystem, fixedUpdate, update };

/*
The player class

    A simple class to maintain state of a player on screen,
    as well as to draw that state when required.
*/

/*
let hx = 8, hy = 8

const game_player_model = {
    // Store the instance, if any
    instance: undefined,
    game: undefined,

    // Set up initial values for our state information
    pos: { x: 0, y: 0 },
    size: { x: 16, y: 16, hx, hy },
    state: 'not-connected',
    color: 'rgba(255,255,255,0.1)',
    info_color: 'rgba(255,255,255,0.1)',
    id: '',

    // These are used in moving us around later
    old_state: { pos:{ x:0, y:0 }},
    cur_state: { pos:{ x:0, y:0 }},
    state_time: new Date().getTime(),

    // Our local history of inputs
    inputs: [ ],

    // The world bounds we are confined to
    pos_limits: {
        x_min: hx,
        x_max: 0, //this.game.world.width - hx,
        y_min: hy,
        y_max: 0 //this.game.world.height - hy
    }
}
*/

function game_player ( game_instance, player_instance ) {

    // Store the instance, if any
    this.instance = player_instance;
    this.game = game_instance;

    // Set up initial values for our state information
    this.size = { x: 16, y: 16, hx: 8, hy: 8 };
    this.state = 'not-connected';
    this.color = 'rgba(255,255,255,0.1)';
    this.info_color = 'rgba(255,255,255,0.1)';
    this.id = '';

    this.last_input_seq = 0;  // 'host input sequence', the last input we processed for the host
    //this.host = false;
    //this.online = true;

    // These are used in moving us around later
    this.old_state = { pos: { x: 0, y: 0 } };
    this.cur_state = { pos: { x: 0, y: 0 } };
    this.state_time = new Date().getTime();

    // Our local history of inputs
    this.inputs = [ ];

    // The world bounds we are confined to
    this.pos_limits = {
        x_min: this.size.hx,
        x_max: this.game.world.width - this.size.hx,
        y_min: this.size.hy,
        y_max: this.game.world.height - this.size.hy
    };

    // The 'host' of a game gets created with a player instance since
    // the server already knows who they are. If the server starts a game
    // with only a host, the other player is set up in the 'else' below
    if (player_instance)
        this.pos = { x: 20, y: 20 };
    else
        this.pos = { x: 500, y: 200 };
}

/*  Copyright 2012-2016 Sven "underscorediscovery" Bergström
    
    written by : http://underscorediscovery.ca
    written for : http://buildnewgames.com/real-time-multiplayer/
    
    MIT Licensed.
*/


// Now the core game class. This gets created on both server and client. Server creates one for
// each game that is hosted, and client creates one for itself to play the game.

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
            self: new game_player(core),
            other: new game_player(core)
        };
    }

    return core;
}


var gameCore = { create };

// (4.22208334636).fixed(n) will return fixed point value to n places, default n = 3
function fixed (val, n=3) {
	return parseFloat(val.toFixed(n));
}

// THREEx.KeyboardState.js keep the current state of the keyboard.
// It is possible to query it at any time. No need of an event.
// This is particularly convenient in loop driven case, like in
// 3D demos or games.
//
// # Usage
//
// **Step 1**: Create the object
//
// ```var keyboard	= new THREEx.KeyboardState();```
//
// **Step 2**: Query the keyboard state
//
// This will return true if shift and A are pressed, false otherwise
//
// ```keyboard.pressed("shift+A")```
//
// **Step 3**: Stop listening to the keyboard
//
// ```keyboard.destroy()```
//
// NOTE: this library may be nice as standaline. independant from three.js
// - rename it keyboardForGame
//
// # Code
//

/** @namespace */
const THREEx = { };

/**
 * - NOTE: it would be quite easy to push event-driven too
 *   - microevent.js for events handling
 *   - in this._onkeyChange, generate a string from the DOM event
 *   - use this as event name
*/
THREEx.KeyboardState	= function () {
	// to store the current state
	this.keyCodes	= {};
	this.modifiers	= {};
	
	// create callback to bind/unbind keyboard events
	var self	= this;
	this._onKeyDown	= function(event){ self._onKeyChange(event, true); };
	this._onKeyUp	= function(event){ self._onKeyChange(event, false);};

	// bind keyEvents
	document.addEventListener("keydown", this._onKeyDown, false);
	document.addEventListener("keyup", this._onKeyUp, false);
};

/**
 * To stop listening of the keyboard events
*/
THREEx.KeyboardState.prototype.destroy	= function () {
	// unbind keyEvents
	document.removeEventListener("keydown", this._onKeyDown, false);
	document.removeEventListener("keyup", this._onKeyUp, false);
};


THREEx.KeyboardState.MODIFIERS	= ['shift', 'ctrl', 'alt', 'meta'];
THREEx.KeyboardState.ALIAS	= {
	'left'		: 37,
	'up'		: 38,
	'right'		: 39,
	'down'		: 40,
	'space'		: 32,
	'pageup'	: 33,
	'pagedown'	: 34,
	'tab'		: 9
};

/**
 * to process the keyboard dom event
*/
THREEx.KeyboardState.prototype._onKeyChange	= function (event, pressed) {
	// log to debug
	//console.log("onKeyChange", event, pressed, event.keyCode, event.shiftKey, event.ctrlKey, event.altKey, event.metaKey)

	// update this.keyCodes
	var keyCode		= event.keyCode;
	this.keyCodes[keyCode]	= pressed;

	// update this.modifiers
	this.modifiers['shift']= event.shiftKey;
	this.modifiers['ctrl']	= event.ctrlKey;
	this.modifiers['alt']	= event.altKey;
	this.modifiers['meta']	= event.metaKey;
};

/**
 * query keyboard state to know if a key is pressed of not
 *
 * @param {String} keyDesc the description of the key. format : modifiers+key e.g shift+A
 * @returns {Boolean} true if the key is pressed, false otherwise
*/
THREEx.KeyboardState.prototype.pressed	= function (keyDesc) {
	var keys	= keyDesc.split("+");
	for(var i = 0; i < keys.length; i++){
		var key		= keys[i];
		var pressed;
		if( THREEx.KeyboardState.MODIFIERS.indexOf( key ) !== -1 ){
			pressed	= this.modifiers[key];
		}else if( Object.keys(THREEx.KeyboardState.ALIAS).indexOf( key ) != -1 ){
			pressed	= this.keyCodes[ THREEx.KeyboardState.ALIAS[key] ];
		}else {
			pressed	= this.keyCodes[key.toUpperCase().charCodeAt(0)];
		}
		if( !pressed)	return false;
	}	return true;
};


if (!window.iip)
	window.iip = new THREEx.KeyboardState();
	

var keyboard = window.iip;

function physics_movement_vector_from_direction (playerspeed, x, y) {
    // Must be fixed step, at physics sync speed.
    return {
        x : fixed(x * (playerspeed * 0.015)),
        y : fixed(y * (playerspeed * 0.015))
    };
}

function inputSystem (world) {

    const onUpdate = function (dt) {
        // get all of the entities in the world that pass the filter
        for (const entity of ECS.getEntities(world, [ 'net_client', 'game_core' ])) {
            const client = entity.net_client;
            const core = entity.game_core;
            
            //if (core.lit > core.local_time) return;
            //core.lit = core.local_time+0.5; // one second delay

            // takes input from the client and keeps a record,
            // It also sends the input information to the server immediately
            // as it is pressed. It also tags each input with a sequence number.

            let x_dir = 0;
            let y_dir = 0;
            const input = [ ];

            if (keyboard.pressed('A') || keyboard.pressed('left')) {
                x_dir = -1;
                input.push('l');
            }

            if (keyboard.pressed('D') || keyboard.pressed('right')) {
                x_dir = 1;
                input.push('r');
            }

            if (keyboard.pressed('S') || keyboard.pressed('down')) {
                y_dir = 1;
                input.push('d');
            }

            if (keyboard.pressed('W') || keyboard.pressed('up')) {
                y_dir = -1;
                input.push('u');
            }

            if (input.length) {
                // Update what sequence we are on now
                client.input_seq += 1;

                // Store the input state as a snapshot of what happened.
                core.players.self.inputs.push({
                    inputs : input,
                    time : fixed(core.local_time),
                    seq : client.input_seq
                });

                // Send the packet of information to the server.
                // The input packets are labelled with an 'i' in front.
                let server_packet = 'i.';
                    server_packet += input.join('-') + '.';
                    server_packet += core.local_time.toFixed(3).replace('.','-') + '.';
                    server_packet += client.input_seq;

                client.socket.send(server_packet);

                // Return the direction if needed
                return physics_movement_vector_from_direction(core.playerspeed, x_dir, y_dir);

            } else {
                return { x: 0, y: 0 };
            }

        }
    };

    return { onUpdate }
}

// copies a 2d vector like object from one to another
function pos (a) {
	return { x: a.x, y: a.y };
}

function process_input (playerspeed, player) {
    // It's possible to have recieved multiple inputs by now, so we process each one
    let x_dir = 0;
    let y_dir = 0;
    const ic = player.inputs.length;

    if (ic) {
        for (let j = 0; j < ic; ++j) {
            // don't process ones we already have simulated locally
            if (player.inputs[j].seq <= player.last_input_seq)
                continue;

            const input = player.inputs[j].inputs;
            const c = input.length;
            for (let i = 0; i < c; ++i) {
                const key = input[i];
                if (key == 'l')
                    x_dir -= 1;

                if (key == 'r')
                    x_dir += 1;

                if (key == 'd')
                    y_dir += 1;

                if (key == 'u')
                    y_dir -= 1;
            } // for all input values

        } // for each input command
    } // if we have inputs

    // we have a direction vector now, so apply the same physics as the client
    const resulting_vector = physics_movement_vector_from_direction(playerspeed, x_dir, y_dir);

    if (player.inputs.length) {
        // we can now clear the array since these have been processed
        player.last_input_time = player.inputs[ic-1].time;
        player.last_input_seq = player.inputs[ic-1].seq;
    }

    return resulting_vector;
}

// Add a 2d vector with another one and return the resulting vector
function v_add (a,b) {
	return { x: fixed(a.x+b.x), y: fixed(a.y+b.y) };
}


// Subtract a 2d vector with another one and return the resulting vector
//game_core.prototype.v_sub = function (a,b) { return { x: fixed(a.x-b.x), y: fixed(a.y-b.y) }; };

// Multiply a 2d vector with a scalar value and return the resulting vector
//game_core.prototype.v_mul_scalar = function (a,b) { return {x: fixed(a.x*b), y: fixed(a.y*b) }; };

function update_physics (client, core) {
    // Fetch the new direction from the input buffer,
    // and apply it to the state so we can smooth it in the visual state
    if (client.client_predict) {
        core.players.self.old_state.pos = pos(core.players.self.cur_state.pos );
        const nd = process_input(core.playerspeed, core.players.self);
        core.players.self.cur_state.pos = v_add(core.players.self.old_state.pos, nd);
        core.players.self.state_time = core.local_time;
    }
}

function movementSystem (world) {

    const onFixedUpdate = function (dt) {
        // get all of the entities in the world that pass the filter
        for (const entity of ECS.getEntities(world, [ 'net_client', 'game_core', 'movement' ])) {
            entity.game_core._pdt = 0.015;
            update_physics(entity.net_client, entity.game_core);
        }
    };

    return { onFixedUpdate }
}

/*
    Shared between server and client.
    In this example, `item` is always of type game_player.
*/
function check_collision (item) {
    //Left wall.
    if (item.pos.x <= item.pos_limits.x_min)
        item.pos.x = item.pos_limits.x_min;

    //Right wall
    if (item.pos.x >= item.pos_limits.x_max )
        item.pos.x = item.pos_limits.x_max;
    
    //Roof wall.
    if (item.pos.y <= item.pos_limits.y_min)
        item.pos.y = item.pos_limits.y_min;

    //Floor wall
    if (item.pos.y >= item.pos_limits.y_max )
        item.pos.y = item.pos_limits.y_max;

    //Fixed point helps be more deterministic
    item.pos.x = fixed(item.pos.x, 4);
    item.pos.y = fixed(item.pos.y, 4);
}

// Simple linear interpolation
function lerp (p, n, t) {
	let _t = Number(t);
	_t = fixed(Math.max(0, Math.min(1, _t)));
	return fixed(p + _t * (n - p));
}

// Simple linear interpolation between 2 vectors
function v_lerp (v, tv, t) {
	return { x: lerp(v.x, tv.x, t), y: lerp(v.y, tv.y, t) };
}

function process_net_updates (client, core) {
    // No updates...
    if (!client.server_updates.length)
        return;

    // First : Find the position in the updates, on the timeline
    // We call this current_time, then we find the past_pos and the target_pos using this,
    // searching throught the server_updates array for current_time in between 2 other times.
    // Then :  other player position = lerp ( past_pos, target_pos, current_time );

    //Find the position in the timeline of updates we stored.
    var current_time = client.client_time;
    var count = client.server_updates.length-1;
    var target = null;
    var previous = null;

    //We look from the 'oldest' updates, since the newest ones
    //are at the end (list.length-1 for example). This will be expensive
    //only when our time is not found on the timeline, since it will run all
    //samples. Usually this iterates very little before breaking out with a target.
    for (var i = 0; i < count; ++i) {

        var point = client.server_updates[i];
        var next_point = client.server_updates[i+1];

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
        target = client.server_updates[0];
        previous = client.server_updates[0];
    }

    //Now that we have a target and a previous destination,
    //We can interpolate between then based on 'how far in between' we are.
    //This is simple percentage maths, value/target = [0,1] range of numbers.
    //lerp requires the 0,1 value to lerp to? thats the one.

     if (target && previous) {

        client.target_time = target.t;

        var difference = client.target_time - current_time;
        var max_difference = fixed(target.t - previous.t);
        var time_point = fixed(difference/max_difference);

        //Because we use the same target and previous in extreme cases
        //It is possible to get incorrect values due to division by 0 difference
        //and such. This is a safe guard and should probably not be here. lol.
        if ( isNaN(time_point) )
        	time_point = 0;
        if (time_point == -Infinity)
        	time_point = 0;
        if (time_point == Infinity)
        	time_point = 0;

        // The most recent server update
        const latest_server_data = client.server_updates[ client.server_updates.length-1 ];

        // These are the exact server positions from this tick, but only for the ghost
        var other_server_pos = core.players.self.host ? latest_server_data.cp : latest_server_data.hp;

        // The other players positions in this timeline, behind us and in front of us
        var other_target_pos = core.players.self.host ? target.cp : target.hp;
        var other_past_pos = core.players.self.host ? previous.cp : previous.hp;

        // update the dest block, this is a simple lerp
        // to the target from the previous point in the server_updates buffer
        client.ghosts.server_pos_other.pos = pos(other_server_pos);
        client.ghosts.pos_other.pos = v_lerp(other_past_pos, other_target_pos, time_point);

        if (client.client_smoothing)
            core.players.other.pos = v_lerp( core.players.other.pos, client.ghosts.pos_other.pos, core._pdt*client.client_smooth);
        else
            core.players.other.pos = pos(client.ghosts.pos_other.pos);

            //Now, if not predicting client movement , we will maintain the local player position
            //using the same method, smoothing the players information from the past.
        if (!client.client_predict && !client.naive_approach) {

                //These are the exact server positions from this tick, but only for the ghost
            var my_server_pos = core.players.self.host ? latest_server_data.hp : latest_server_data.cp;

                //The other players positions in this timeline, behind us and in front of us
            var my_target_pos = core.players.self.host ? target.hp : target.cp;
            var my_past_pos = core.players.self.host ? previous.hp : previous.cp;

                //Snap the ghost to the new server position
            client.ghosts.server_pos_self.pos = pos(my_server_pos);
            var local_target = v_lerp(my_past_pos, my_target_pos, time_point);

                //Smoothly follow the destination position
            if (client.client_smoothing)
                core.players.self.pos = v_lerp( core.players.self.pos, local_target, core._pdt*client.client_smooth);
            else
                core.players.self.pos = pos( local_target );
        }

    } //if target && previous
}


function update_local_position (client, core) {
	 if (client.client_predict) {
	    // Work out the time we have since we updated the state
	    //var t = (core.local_time - core.players.self.state_time) / core._pdt;

	    // store the states for clarity,
	    var old_state = core.players.self.old_state.pos;
	    var current_state = core.players.self.cur_state.pos;

	    // Make sure the visual position matches the states we have stored
	    //core.players.self.pos = v_add( old_state, core.v_mul_scalar( core.v_sub(current_state,old_state), t )  );
	    core.players.self.pos = current_state;
	    
	    // handle collision on client if predicting.
	    check_collision(core.players.self);
    }
}


function connect_to_server (client, core) {  
    // Store a local reference to our connection to the server
    client.socket = io.connect();

    // When we connect, we are not 'connected' until we have a server id
    // and are placed in a game by the server. The server sends us a message for that.
    client.socket.on('connect', function () {
        core.players.self.state = 'connecting';
    });

    // Sent when we are disconnected (network, server down, etc)
    client.socket.on('disconnect', function (data) {
        ondisconnect(core);
    });

    // Sent each tick of the server simulation. This is our authoritive update
    client.socket.on('onserverupdate', function (data) {
        onserverupdate_recieved(data, client, core);
    });

    // Handle when we connect to the server, showing state and storing id's.
    client.socket.on('onconnected', function (data) {
        onconnected(core, data);
    });

    // On error we just show that we are not connected for now. Can print the data.
    client.socket.on('error', function (data) {
        ondisconnect(core);
    });

    // On message from the server, we parse the commands and send it to the handlers
    client.socket.on('message', function (data) {
        onnetmessage(client, core, data);
    });
}


function onserverupdate_recieved (data, client, core) {
    // Lets clarify the information we have locally. One of the players is 'hosting' and
    // the other is a joined in client, so we name these host and client for making sure
    // the positions we get from the server are mapped onto the correct local sprites
    const player_host = core.players.self.host ?  core.players.self : core.players.other;
    const player_client = core.players.self.host ?  core.players.other : core.players.self;
    const this_player = core.players.self;
        
    // Store the server time (this is offset by the latency in the network, by the time we get it)
    client.server_time = data.t;
    // Update our local offset time from the last server update
    client.client_time = client.server_time - (client.net_offset/1000);

    // One approach is to set the position directly as the server tells you.
    // This is a common mistake and causes somewhat playable results on a local LAN, for example,
    // but causes terrible lag when any ping/latency is introduced. The player can not deduce any
    // information to interpolate with so it misses positions, and packet loss destroys this approach
    // even more so. See 'the bouncing ball problem' on Wikipedia.

    if (client.naive_approach) {
        if (data.hp)
            player_host.pos = pos(data.hp);

        if (data.cp)
            player_client.pos = pos(data.cp);

    } else {
        //Cache the data from the server,
        //and then play the timeline
        //back to the player with a small delay (net_offset), allowing
        //interpolation between the points.
        client.server_updates.push(data);

        //we limit the buffer in seconds worth of updates
        //60fps*buffer seconds = number of samples
        if (client.server_updates.length >= ( 60*client.buffer_size ))
            client.server_updates.splice(0,1);

        //We can see when the last tick we know of happened.
        //If client_time gets behind this due to latency, a snap occurs
        //to the last tick. Unavoidable, and a reallly bad connection here.
        //If that happens it might be best to drop the game after a period of time.
        client.oldest_tick = client.server_updates[0].t;

        //Handle the latest positions from the server
        //and make sure to correct our local predictions, making the server have final say.
        process_net_prediction_correction(client, core);     
    }
}


function reset_positions (client, core) {

    var player_host = core.players.self.host ?  core.players.self : core.players.other;
    var player_client = core.players.self.host ?  core.players.other : core.players.self;

    // Host always spawns at the top left.
    player_host.pos = { x: 20, y: 20 };
    player_client.pos = { x: 500, y: 200 };

        //Make sure the local player physics is updated
    core.players.self.old_state.pos = pos(core.players.self.pos);
    core.players.self.pos = pos(core.players.self.pos);
    core.players.self.cur_state.pos = pos(core.players.self.pos);

    // Position all debug view items to their owners position
    client.ghosts.server_pos_self.pos = pos(core.players.self.pos);

    client.ghosts.server_pos_other.pos = pos(core.players.other.pos);
    client.ghosts.pos_other.pos = pos(core.players.other.pos);
}


function onreadygame (client, core, data) {

    var server_time = parseFloat(data.replace('-','.'));

    var player_host = core.players.self.host ?  core.players.self : core.players.other;
    var player_client = core.players.self.host ?  core.players.other : core.players.self;

    core.local_time = server_time + client.net_latency;
    console.log('server time is about ' + core.local_time);

	// store their info colors for clarity. server is always blue
	player_host.info_color = '#2288cc';
	player_client.info_color = '#cc8822';

	// update their information
	player_host.state = 'local_pos(hosting)';
	player_client.state = 'local_pos(joined)';

	core.players.self.state = 'YOU ' + core.players.self.state;

	// make sure colors are synced up
    client.socket.send('c.' + core.players.self.color);
}


function onjoingame (client, core, data) {
	//We are not the host
	core.players.self.host = false;
	//Update the local state
	core.players.self.state = 'connected.joined.waiting';
	core.players.self.info_color = '#00bb00';

	//Make sure the positions match servers and other clients
	reset_positions(client, core);
}


function onhostgame (client, core, data) {
	//The server sends the time when asking us to host, but it should be a new game.
	//so the value will be really small anyway (15 or 16ms)
	var server_time = parseFloat(data.replace('-','.'));

	//Get an estimate of the current time on the server
	core.local_time = server_time + client.net_latency;

	//Set the flag that we are hosting, this helps us position respawns correctly
	core.players.self.host = true;

	//Update debugging information to display state
	core.players.self.state = 'hosting.waiting for a player';
	core.players.self.info_color = '#cc0000';

	//Make sure we start in the correct place as the host.
    reset_positions(client, core);
}


function onconnected (core, data) {
    //The server responded that we are now in a game,
    //this lets us store the information about ourselves and set the colors
    //to show we are now ready to be playing.
    core.players.self.id = data.id;
    core.players.self.info_color = '#cc0000';
    core.players.self.state = 'connected';
    core.players.self.online = true;
}


function on_otherclientcolorchange (core, data) {
    core.players.other.color = data;
}


function onping (client, data) {
    client.net_ping = new Date().getTime() - parseFloat(data);
    client.net_latency = client.net_ping/2;
}


function onnetmessage (client, core, data) {
    var commands = data.split('.');
    var command = commands[0];
    var subcommand = commands[1] || null;
    var commanddata = commands[2] || null;

    switch(command) {
        case 's': // server message
            switch(subcommand) {

                case 'h' : //host a game requested
                    onhostgame(client, core, commanddata); break;

                case 'j' : //join a game requested
                    onjoingame(client, core); break;

                case 'r' : //ready a game requested
                    onreadygame(client, core, commanddata); break;

                case 'e' : //end game requested
                    ondisconnect(core); break;

                case 'p' : //server ping
                    onping(client, commanddata); break;

                case 'c' : //other player changed colors
                    on_otherclientcolorchange(core, commanddata); break;

            }

        break;
    } 
}


function ondisconnect (core, data) {
    // When we disconnect, we don't know if the other player is
    // connected or not, and since we aren't, everything goes to offline

    core.players.self.info_color = 'rgba(255,255,255,0.1)';
    core.players.self.state = 'not-connected';
    core.players.self.online = false;

    core.players.other.info_color = 'rgba(255,255,255,0.1)';
    core.players.other.state = 'not-connected';
}


function process_net_prediction_correction (client, core) {
    // No updates...
    if (!client.server_updates.length)
        return;

    // The most recent server update
    const latest_server_data = client.server_updates[client.server_updates.length-1];

    // Our latest server position
    var my_server_pos = core.players.self.host ? latest_server_data.hp : latest_server_data.cp;

    // Update the debug server position block
    client.ghosts.server_pos_self.pos = pos(my_server_pos);

    // here we handle our local input prediction ,
    // by correcting it with the server and reconciling its differences

    const my_last_input_on_server = core.players.self.host ? latest_server_data.his : latest_server_data.cis;
    if (my_last_input_on_server) {
        // The last input sequence index in my local input list
        let lastinputseq_index = -1;
        // Find this input in the list, and store the index
        for (let i = 0; i < core.players.self.inputs.length; ++i) {
            if (core.players.self.inputs[i].seq == my_last_input_on_server) {
                lastinputseq_index = i;
                break;
            }
        }

        // crop the list of any updates we have already processed
        if (lastinputseq_index != -1) {
            // so we have now gotten an acknowledgement from the server that our inputs here have been accepted
            // and that we can predict from this known position instead

            // remove the rest of the inputs we have confirmed on the server
            const number_to_clear = Math.abs(lastinputseq_index - (-1));
            core.players.self.inputs.splice(0, number_to_clear);
            // The player is now located at the new server position, authoritive server
            core.players.self.cur_state.pos = pos(my_server_pos);
            core.players.self.last_input_seq = lastinputseq_index;
            // Now we reapply all the inputs that we have locally that
            // the server hasn't yet confirmed. This will 'keep' our position the same,
            // but also confirm the server position at the same time.
            update_physics(client, core);
            update_local_position(core);
        }
    }
}


function netClientSystem (world) {

    const onUpdate = function (dt) {

    	const newTime = performance.now();

        // get all of the entities in the world that pass the filter
        for (const entity of ECS.getEntities(world, [ 'net_client', 'game_core' ])) {
        	const client = entity.net_client;
        	const game = entity.game_core;

        	if (!client.socket) {
    			connect_to_server(client, game);
    			continue;
        	}

        	// TODO: check client socket state here


            // Ping the server every second, to determine the latency between
	    	// client and server and calculate roughly how our connection is doing
			if (newTime - client.last_ping_time >= 1000) {
				client.last_ping_time = newTime - client.fake_lag;
				client.socket.send('p.' + (client.last_ping_time) );
			}

		    // Network player just gets drawn normally, with interpolation from
		    // the server updates, smoothing out the positions from the past.
		    // Note that if we don't have prediction enabled - this will also
		    // update the actual local client position on screen as well.
		    if (!client.naive_approach)
		        process_net_updates(client, game);

		    // When we are doing client side prediction, we smooth out our position
		    // across frames using local input states we have stored.
		    update_local_position(client, game);
        }
    };

    return { onUpdate }
}

/*  Copyright 2012-2016 Sven "underscorediscovery" Bergström

written by : http://underscorediscovery.ca
written for : http://buildnewgames.com/real-time-multiplayer/

MIT Licensed.
*/


function refresh_fps (client) {
    // We store the fps for 10 frames, by adding it to this accumulator
    client.fps = 1 / client.dt;
    client.fps_avg_acc += client.fps;
    client.fps_avg_count++;

    // When we reach 10 frames we work out the average fps
    if (client.fps_avg_count >= 10) {
        client.fps_avg = client.fps_avg_acc/10;
        client.fps_avg_count = 1;
        client.fps_avg_acc = client.fps;
    }
}


function drawInfo (client, core) {
    // don't want this to be too distracting
    client.ctx.fillStyle = 'rgba(255,255,255,0.3)';

    if (client.show_help) {
        client.ctx.fillText('net_offset : local offset of others players and their server updates. Players are net_offset "in the past" so we can smoothly draw them interpolated.', 10 , 30);
        client.ctx.fillText('server_time : last known game time on server', 10 , 70);
        client.ctx.fillText('client_time : delayed game time on client for other players only (includes the net_offset)', 10 , 90);
        client.ctx.fillText('net_latency : Time from you to the server. ', 10 , 130);
        client.ctx.fillText('net_ping : Time from you to the server and back. ', 10 , 150);
        client.ctx.fillText('fake_lag : Add fake ping/lag for testing, applies only to your inputs (watch server_pos block!). ', 10 , 170);
        client.ctx.fillText('client_smoothing/client_smooth : When updating players information from the server, it can smooth them out.', 10 , 210);
        client.ctx.fillText(' This only applies to other clients when prediction is enabled, and applies to local player with no prediction.', 170 , 230);
    }

    if (core.players.self.host) {
        client.ctx.fillStyle = 'rgba(255,255,255,0.7)';
        client.ctx.fillText('You are the host', 10 , 465);
    }

    client.ctx.fillStyle = 'rgba(255,255,255,1)';
}


function drawPlayer (client, player) {
    const game = player.game;

    // Set the color for this player
    client.ctx.fillStyle = player.color;

    // Draw a rectangle for us
    client.ctx.fillRect(player.pos.x - player.size.hx, player.pos.y - player.size.hy, player.size.x, player.size.y);

    // Draw a status update
    client.ctx.fillStyle = player.info_color;
    client.ctx.fillText(player.state, player.pos.x+10, player.pos.y + 4);
}


function create_debug_gui (client, core) {

    client.gui = new dat.GUI();

    const _playersettings = client.gui.addFolder('Your settings');

    client.colorcontrol = _playersettings.addColor(core, 'color');

    //We want to know when we change our color so we can tell
    //the server to tell the other clients for us
    client.colorcontrol.onChange(function (value) {
        core.players.self.color = value;
        localStorage.setItem('color', value);
        client.socket.send('c.' + value);
    });

    _playersettings.open();

    const _othersettings = client.gui.addFolder('Methods');

    _othersettings.add(client, 'naive_approach').listen();
    _othersettings.add(client, 'client_smoothing').listen();
    _othersettings.add(client, 'client_smooth').listen();
    _othersettings.add(client, 'client_predict').listen();

    const _debugsettings = client.gui.addFolder('Debug view');
        
    _debugsettings.add(client, 'show_help').listen();
    _debugsettings.add(client, 'fps_avg').listen();
    _debugsettings.add(client, 'show_server_pos').listen();
    _debugsettings.add(client, 'show_dest_pos').listen();
    _debugsettings.add(core, 'local_time').listen();

    _debugsettings.open();

    const _consettings = client.gui.addFolder('Connection');
    _consettings.add(client, 'net_latency').step(0.001).listen();
    _consettings.add(client, 'net_ping').step(0.001).listen();

    //When adding fake lag, we need to tell the server about it.
    const lag_control = _consettings.add(client, 'fake_lag').step(0.001).listen();
    lag_control.onChange(function (value) {
        client.socket.send('l.' + value);
    });

    _consettings.open();

    const _netsettings = client.gui.addFolder('Networking');

    _netsettings.add(client, 'net_offset').min(0.01).step(0.001).listen();
    _netsettings.add(client, 'server_time').step(0.001).listen();
    _netsettings.add(client, 'client_time').step(0.001).listen();
    //_netsettings.add(core, 'oldest_tick').step(0.001).listen();

    _netsettings.open();
}


function createClient (core) {

	const ghosts = {
		// Our ghost position on the server
        server_pos_self: new game_player(core),

        // The other players server position as we receive it
        server_pos_other: new game_player(core),

        // The other players ghost destination position (the lerp)
        pos_other: new game_player(core)
    };

	ghosts.pos_other.state = 'dest_pos';

    ghosts.pos_other.info_color = 'rgba(255,255,255,0.1)';

    ghosts.server_pos_self.info_color = 'rgba(255,255,255,0.2)';
    ghosts.server_pos_other.info_color = 'rgba(255,255,255,0.2)';

    ghosts.server_pos_self.state = 'server_pos';
    ghosts.server_pos_other.state = 'server_pos';

    ghosts.server_pos_self.pos = { x: 20, y: 20 };
    ghosts.pos_other.pos = { x: 500, y: 200 };
    ghosts.server_pos_other.pos = { x: 500, y: 200 };

	const client = {
		// Debugging ghosts, to help visualise things
		ghosts,

		// A list of recent server updates we interpolate across
	    // This is the buffer that is the driving factor for our networking
	    server_updates: [ ],

	    // Set their colors from the storage or locally
	    //color: '#cc8822', //localStorage.getItem('color') || '#cc8822'

	    socket: undefined,
	    ctx: undefined,
	    gui: undefined,
	    colorcontrol: undefined,

	    show_help: false,             // Whether or not to draw the help text
	    naive_approach: false,        // Whether or not to use the naive approach
	    show_server_pos: false,       // Whether or not to show the server position
	    show_dest_pos: false,         // Whether or not to show the interpolation goal
	    client_predict: true,         // Whether or not the client is predicting input
	    input_seq: 0,                 // When predicting client inputs, we store the last input as a sequence number
	    client_smoothing: true,       // Whether or not the client side prediction tries to smooth things out
	    client_smooth: 25,            // amount of smoothing to apply to client update dest

	    net_latency: 0.001,           // the latency between the client and the server (ping/2)
	    net_ping: 0.001,              // The round trip time from here to the server,and back
	    last_ping_time: 0.001,        // The time we last sent a ping
	    fake_lag: 0,                  // If we are simulating lag, this applies only to the input client (not others)
	    //fake_lag_time: 0,

	    net_offset: 100,              // 100 ms latency between server and client interpolation for other clients
	    buffer_size: 2,               // The size of the server history to keep for rewinding/interpolating.
	    target_time: 0.01,            // the time where we want to be in the server timeline
	    oldest_tick: 0.01,            // the last time tick we have available in the buffer

	    client_time: 0.01,            // Our local 'clock' based on server time - client interpolation(net_offset).
	    server_time: 0.01,            // The time the server reported it was at, last we heard from it
	    
	    dt: 0.016,                    // The time that the last frame took to run
	    fps: 0,                       // The current instantaneous fps (1/this.dt)
	    fps_avg_count: 0,             // The number of samples we have taken for fps_avg
	    fps_avg: 0,                   // The current average fps displayed in the debug UI
	    fps_avg_acc: 0                // The accumulation of the last avgcount fps samples
	};

	return client;
}


// When loading, we store references to our drawing canvases, and initiate a game instance.
window.onload = function () {

    const world = ECS.createWorld();

    // Create our game client instance.
    const game = gameCore.create();
    const client = createClient(game);

    const clientEntity = ECS.createEntity(world);
    ECS.addComponentToEntity(world, clientEntity, 'game_core', game);
    ECS.addComponentToEntity(world, clientEntity, 'net_client', client);
    ECS.addComponentToEntity(world, clientEntity, 'movement');

    ECS.addSystem(world, inputSystem);
    ECS.addSystem(world, movementSystem);
    ECS.addSystem(world, netClientSystem);


    // Set player colors from the storage or locally
    game.color = localStorage.getItem('color') || '#cc8822' ;
    localStorage.setItem('color', game.color);
    game.players.self.color = game.color;

	// Make this only if requested
    if (String(window.location).indexOf('debug') != -1)
        create_debug_gui(client, game);

	const viewport = document.getElementById('viewport');
	viewport.width = game.world.width;
	viewport.height = game.world.height;

	client.ctx = viewport.getContext('2d');
	client.ctx.font = '11px "Helvetica"';


	let currentTime = performance.now(), accumulator = 0;

	const PHYSICS_FRAME_TICK = 1000 / 15; // physics runs @ 15 fps


	// inspired by https://gafferongames.com/post/fix_your_timestep/
	const update = function () {
		const newTime = performance.now();
		const frameTime = newTime - currentTime;
		currentTime = newTime;

		client.dt = frameTime / 1000.0;

		game.local_time += client.dt;

		accumulator += frameTime;

        // reset accumulator when > 2 seconds of time has elapsed since last step
        // e.g., when the game window is restored after being hidden for a while
        if (accumulator > 2000)
            accumulator = 0;

		while (accumulator >= PHYSICS_FRAME_TICK) {
			accumulator -= PHYSICS_FRAME_TICK;
            ECS.fixedUpdate(world, PHYSICS_FRAME_TICK);
		}

        ECS.update(world, frameTime);

	    // Update the game specifics and schedule the next update
	    // Clear the screen area
	    client.ctx.clearRect(0, 0, 720, 480);

	    // draw help/information if required
	    drawInfo(client, game);
	    
	    // Now they should have updated, we can draw the entity
	    drawPlayer(client, game.players.other);

	    // And then we finally draw
	    drawPlayer(client, game.players.self);

	    // and these
	    if (client.show_dest_pos && !client.naive_approach)
	    	drawPlayer(client, client.ghosts.pos_other);

	    // and lastly draw these
	    if (client.show_server_pos && !client.naive_approach) {
	    	drawPlayer(client, client.ghosts.server_pos_self);
	        drawPlayer(client, client.ghosts.server_pos_other);
	    }

	    refresh_fps(client);   // work out the fps average

		game.updateid = window.requestAnimationFrame(update);
	};

	update();
};
