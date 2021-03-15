export const PHYSICS_FRAME_TICK = 16;  // physics and input run @ 62.5fps (16ms per frame)
export const PHYSICS_FRAME_TIME = PHYSICS_FRAME_TICK / 1000.0;

export const SERVER_BROADCAST_TICK = PHYSICS_FRAME_TICK * 3; // broadcast state every 3 physics frames
export const SERVER_BROADCAST_TIME = SERVER_BROADCAST_TICK / 1000.0;
