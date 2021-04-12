import ECS      from 'https://cdn.skypack.dev/ecs';
import Renderer from './Renderer.js';


function drawInfo (client, core, ctx) {
    // don't want this to be too distracting
    ctx.fillStyle = 'rgba(255,255,255,0.3)';

    if (core.players.self.host) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('You are the host', 10 , 465);
    }

    ctx.fillStyle = 'rgba(255,255,255,1)';
}


function drawPlayer (player, ctx) {
    // Set the color for this player
    ctx.fillStyle = player.color;

    // Draw a rectangle for us
    ctx.fillRect(player.pos[0] - player.size.hx, player.pos[1] - player.size.hy, player.size.w, player.size.h);

    // Draw a status update
    ctx.fillStyle = player.info_color;
    ctx.fillText(player.state, player.pos[0]+10, player.pos[1] + 4);
}


export default function rendererSystem (world) {

    const onUpdate = function (dt) {

        for (const entity of ECS.getEntities(world, [ 'net_client', 'game_core' ])) {
            const client = entity.net_client;
            const game = entity.game_core;

            Renderer.ctx.clearRect(0, 0, 720, 480);

            // draw help/information if required
            drawInfo(client, game, Renderer.ctx);
            
            // Now they should have updated, we can draw the entity
            drawPlayer(game.players.other, Renderer.ctx);

            // And then we finally draw
            drawPlayer(game.players.self, Renderer.ctx);
        }
    };

    return { onUpdate }
}
