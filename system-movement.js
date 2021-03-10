import ECS            from 'https://cdn.skypack.dev/ecs';
import update_physics from './update-physics.js';



export default function movementSystem (world) {

    const onFixedUpdate = function (dt) {
        // get all of the entities in the world that pass the filter
        for (const entity of ECS.getEntities(world, [ 'net_client', 'game_core', 'movement' ])) {
            entity.game_core._pdt = 0.015;
            update_physics(entity.net_client, entity.game_core);
        }
    }

    return { onFixedUpdate }
}
