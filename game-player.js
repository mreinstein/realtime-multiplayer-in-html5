
// stores the state of the on-screen player
export default function player ( playerSocket ) {
    this.socket = playerSocket;

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
    
    //this.state_time = Date.now();

    // Our local history of inputs
    this.inputs = [ ];

    // The 'host' of a game gets created with a player socket since
    // the server already knows who they are. If the server starts a game
    // with only a host, the other player is set up in the 'else' below
    if (playerSocket)
        this.pos = { x: 20, y: 20 };
    else
        this.pos = { x: 500, y: 200 };
}
