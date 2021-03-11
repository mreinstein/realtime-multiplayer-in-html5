
// stores the state of the on-screen player
export default function gamePlayer (playerSocket) {
    this.socket = playerSocket;

    // Set up initial values for our state information
    this.size = { w: 16, h: 16, hx: 8, hy: 8 };
    this.state = 'not-connected';
    this.color = 'rgba(255,255,255,0.1)';
    this.info_color = 'rgba(255,255,255,0.1)';
    this.id = '';

    this.last_input_seq = 0;  // 'host input sequence', the last input we processed for the host

    // These are used in moving us around later
    this.old_state = { pos: [ 0, 0 ] };
    this.cur_state = { pos: [ 0, 0 ] };

    // Our local history of inputs
    this.inputs = [ ];

    // The 'host' of a game gets created with a player socket since
    // the server already knows who they are. If the server starts a game
    // with only a host, the other player is set up in the 'else' below
    this.pos = playerSocket ? [ 20, 20 ] : [ 500, 200 ];
}
