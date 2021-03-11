
// stores the state of the on-screen player
export default function gamePlayer (playerSocket) {
    return {
        socket: playerSocket,

        size: { w: 16, h: 16, hx: 8, hy: 8 },
        state: 'not-connected',
        color: 'rgba(255,255,255,0.1)',
        info_color: 'rgba(255,255,255,0.1)',
        id: '',

        last_input_seq: 0,  // 'host input sequence', the last input we processed for the host

        // used in moving us around later
        old_state: { pos: [ 0, 0 ] },
        cur_state: { pos: [ 0, 0 ] },

        // Our local history of inputs
        inputs: [ ],

        // The 'host' of a game gets created with a player socket since
        // the server already knows who they are.
        pos: playerSocket ? [ 20, 20 ] : [ 500, 200 ]
    };
}
