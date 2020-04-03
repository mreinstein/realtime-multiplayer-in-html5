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

export default function game_player ( game_instance, player_instance ) {

    //Store the instance, if any
    this.instance = player_instance;
    this.game = game_instance;

    //Set up initial values for our state information
    this.pos = { x:0, y:0 };
    this.size = { x:16, y:16, hx:8, hy:8 };
    this.state = 'not-connected';
    this.color = 'rgba(255,255,255,0.1)';
    this.info_color = 'rgba(255,255,255,0.1)';
    this.id = '';

    //These are used in moving us around later
    this.old_state = {pos:{x:0,y:0}};
    this.cur_state = {pos:{x:0,y:0}};
    this.state_time = new Date().getTime();

    //Our local history of inputs
    this.inputs = [ ];

    //The world bounds we are confined to
    this.pos_limits = {
        x_min: this.size.hx,
        x_max: this.game.world.width - this.size.hx,
        y_min: this.size.hy,
        y_max: this.game.world.height - this.size.hy
    };

    //The 'host' of a game gets created with a player instance since
    //the server already knows who they are. If the server starts a game
    //with only a host, the other player is set up in the 'else' below
    if (player_instance)
        this.pos = { x:20, y:20 };
    else
        this.pos = { x:500, y:200 };
}
