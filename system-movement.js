import ECS           from 'https://cdn.skypack.dev/ecs';
import updatePhysics from './update-physics.js';


export default function movementSystem (world) {

    const onFixedUpdate = function (dt) {	
        
        for (const entity of ECS.getEntities(world, [ 'net_client', 'game_core', 'movement' ])) {
            updatePhysics(entity.net_client, entity.game_core);
        }
    }

    return { onFixedUpdate }
}
