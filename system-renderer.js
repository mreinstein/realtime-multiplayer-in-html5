import ECS      from 'https://cdn.skypack.dev/ecs';
import Renderer from './Renderer.js';


function drawInfo (client, core, ctx) {
    // don't want this to be too distracting
    ctx.fillStyle = 'rgba(255,255,255,0.3)';

    if (client.show_help) {
        ctx.fillText('interpolation_offset : local offset of others players and their server updates. Players are interpolation_offset "in the past" so we can smoothly draw them interpolated.', 10 , 30);
        ctx.fillText('server_time : last known game time on server', 10 , 70);
        ctx.fillText('client_time : delayed game time on client for other players only (includes the interpolation_offset)', 10 , 90);
        ctx.fillText('net_latency : Time from you to the server. ', 10 , 130);
        ctx.fillText('net_ping : Time from you to the server and back. ', 10 , 150);
        ctx.fillText('fake_lag : Add fake ping/lag for testing, applies only to your inputs (watch server_pos block!). ', 10 , 170);
        ctx.fillText('client_smoothing/client_smooth : When updating players information from the server, it can smooth them out.', 10 , 210);
        ctx.fillText(' This only applies to other clients when prediction is enabled, and applies to local player with no prediction.', 170 , 230);
    }

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

            // and these
            if (client.show_dest_pos)
                drawPlayer(client.ghosts.pos_other, Renderer.ctx);

            // and lastly draw these
            if (client.show_server_pos) {
                drawPlayer(client.ghosts.server_pos_self, Renderer.ctx);
                drawPlayer(client.ghosts.server_pos_other, Renderer.ctx);
            }
        }
    };

    return { onUpdate }
}
