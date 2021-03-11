import pos          from './lib/pos.js';
import processInput from './process-input.js';
import v_add        from './lib/v-add.js';


export default function updatePhysics (client, core) {
    // Fetch the new direction from the input buffer,
    // and apply it to the state so we can smooth it in the visual state
    if (client.client_predict) {
        core.players.self.old_state.pos = pos(core.players.self.cur_state.pos );
        const nd = processInput(core.playerspeed, core.players.self);
        core.players.self.cur_state.pos = v_add(core.players.self.old_state.pos, nd);
    }
}
