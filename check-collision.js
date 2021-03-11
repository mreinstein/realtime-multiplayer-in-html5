import fixed from './lib/fixed.js';

/*
    Shared between server and client.
    In this example, `item` is always of type game_player.
*/
export default function checkCollision (world, item) {

    // The world bounds we are confined to
    const pos_limits = {
        x_min: item.size.hx,
        x_max: world.width - item.size.hx,
        y_min: item.size.hy,
        y_max: world.height - item.size.hy
    };

    // Left wall.
    if (item.pos[0] <= pos_limits.x_min)
        item.pos[0] = pos_limits.x_min;

    // Right wall
    if (item.pos[0] >= pos_limits.x_max )
        item.pos[0] = pos_limits.x_max;
    
    // Roof wall.
    if (item.pos[1] <= pos_limits.y_min)
        item.pos[1] = pos_limits.y_min;

    // Floor wall
    if (item.pos[1] >= pos_limits.y_max )
        item.pos[1] = pos_limits.y_max;

    // Fixed point helps be more deterministic
    item.pos[0] = fixed(item.pos[0], 4);
    item.pos[1] = fixed(item.pos[1], 4);
}
