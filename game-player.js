
// stores the state of the on-screen player
export default function gamePlayer (socket, pos=[ 500, 200 ]) {
    return {
        socket,

        size: { w: 16, h: 16, hx: 8, hy: 8 },
        state: 'not-connected',
        color: 'rgba(255,255,255,0.1)',
        info_color: 'rgba(255,255,255,0.1)',

        id: '', // uuid used to uniquely identify the player

        last_input_seq: 0,  // the last input we processed for this player

        // used in moving us around later
        cur_state: { pos: [ 0, 0 ] },

        // our local history of inputs
        /*
        example structure of an input entry:
            {
                inputs: [ 'l', 'u', 'd' ],
                seq: 306
            }
        */
        inputs: [ ],

        // rendered player position
        pos
    };
}
