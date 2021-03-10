import ECS from 'https://cdn.skypack.dev/ecs';


function drawInfo (client, core) {
    // don't want this to be too distracting
    client.ctx.fillStyle = 'rgba(255,255,255,0.3)';

    if (client.show_help) {
        client.ctx.fillText('net_offset : local offset of others players and their server updates. Players are net_offset "in the past" so we can smoothly draw them interpolated.', 10 , 30);
        client.ctx.fillText('server_time : last known game time on server', 10 , 70);
        client.ctx.fillText('client_time : delayed game time on client for other players only (includes the net_offset)', 10 , 90);
        client.ctx.fillText('net_latency : Time from you to the server. ', 10 , 130);
        client.ctx.fillText('net_ping : Time from you to the server and back. ', 10 , 150);
        client.ctx.fillText('fake_lag : Add fake ping/lag for testing, applies only to your inputs (watch server_pos block!). ', 10 , 170);
        client.ctx.fillText('client_smoothing/client_smooth : When updating players information from the server, it can smooth them out.', 10 , 210);
        client.ctx.fillText(' This only applies to other clients when prediction is enabled, and applies to local player with no prediction.', 170 , 230);
    }

    if (core.players.self.host) {
        client.ctx.fillStyle = 'rgba(255,255,255,0.7)';
        client.ctx.fillText('You are the host', 10 , 465);
    }

    client.ctx.fillStyle = 'rgba(255,255,255,1)';
}


function drawPlayer (client, player) {
    // Set the color for this player
    client.ctx.fillStyle = player.color;

    // Draw a rectangle for us
    client.ctx.fillRect(player.pos.x - player.size.hx, player.pos.y - player.size.hy, player.size.x, player.size.y);

    // Draw a status update
    client.ctx.fillStyle = player.info_color;
    client.ctx.fillText(player.state, player.pos.x+10, player.pos.y + 4);
}


export default function rendererSystem (world) {

    const onUpdate = function (dt) {

        // get all of the entities in the world that pass the filter
        for (const entity of ECS.getEntities(world, [ 'net_client', 'game_core' ])) {
            const client = entity.net_client;
            const game = entity.game_core;

            client.ctx.clearRect(0, 0, 720, 480);

            // draw help/information if required
            drawInfo(client, game);
            
            // Now they should have updated, we can draw the entity
            drawPlayer(client, game.players.other);

            // And then we finally draw
            drawPlayer(client, game.players.self);

            // and these
            if (client.show_dest_pos && !client.naive_approach)
                drawPlayer(client, client.ghosts.pos_other);

            // and lastly draw these
            if (client.show_server_pos && !client.naive_approach) {
                drawPlayer(client, client.ghosts.server_pos_self);
                drawPlayer(client, client.ghosts.server_pos_other);
            }
        }
    };

    return { onUpdate }
}
