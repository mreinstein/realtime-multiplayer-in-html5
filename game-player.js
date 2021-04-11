
// stores the state of the on-screen player
export default function gamePlayer (playerSocket, pos=[ 500, 200 ]) {
    return {
        socket: playerSocket,

        size: { w: 16, h: 16, hx: 8, hy: 8 },
        state: 'not-connected',
        color: 'rgba(255,255,255,0.1)',
        info_color: 'rgba(255,255,255,0.1)',
        id: '',

        last_input_seq: 0,  // the last input we processed for this player

        // used in moving us around later
        old_state: { pos: [ 0, 0 ] },
        cur_state: { pos: [ 0, 0 ] },

        // Our local history of inputs
        /*
        example structure of an input entry:
            {
                inputs: [ 'l', 'u', 'd' ],
                time: 8934.34,
                seq: 306
            }
        */
        inputs: [ ],

        pos
    };
}
