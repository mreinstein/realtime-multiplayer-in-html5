const game_core_model = {
    instance: undefined,

    // Store a flag if we are the server
    server: false, 

    // Used in collision etc.
    world: {
        width : 720,
        height : 480
    },

    players: {
        self : undefined,
        other : undefined
    },

    // The speed at which the clients move.
    playerspeed: 120,

    // run the local game at 16ms, 60hz. on server we run at 45ms, 22hz
    frame_time: ('undefined' != typeof(global)) ? 45 : 60 / 1000,
    lastframetime: 0,

    // Set up some physics integration values
    _pdt: 0.0001,                // The physics update delta time
    _pdte: new Date().getTime(), // The physics update last delta time
    
    // A local timer for precision on server and client
    local_time: 0.016,           // The local timer
    _dt: new Date().getTime(),   // The local timer delta
    _dte: new Date().getTime(),   // The local timer last frame time

    // this is the result of calling requestAnimationFrame or setTmeout (handle to next update callback)
    // can be used to cancel/stop the update loop
    updateid: undefined,

    
    // server only fields
    server_time: 0,
    laststate: { },
    

    // client only fields
    ghosts: {
        //Our ghost position on the server
        server_pos_self: undefined,
        //The other players server position as we receive it
        server_pos_other : undefined,
        //The other players ghost destination position (the lerp)
        pos_other : undefined
    },

    keyboard: undefined,
   
    // A list of recent server updates we interpolate across
    // This is the buffer that is the driving factor for our networking
    server_updates: [ ],

    // Set their colors from the storage or locally
    color: '#cc8822', //localStorage.getItem('color') || '#cc8822'

    socket: undefined,
    ctx: undefined,
    gui: undefined,
    colorcontrol: undefined,

    show_help: false,             //Whether or not to draw the help text
    naive_approach: false,        //Whether or not to use the naive approach
    show_server_pos: false,       //Whether or not to show the server position
    show_dest_pos: false,         //Whether or not to show the interpolation goal
    client_predict: true,         //Whether or not the client is predicting input
    input_seq: 0,                 //When predicting client inputs, we store the last input as a sequence number
    client_smoothing: true,       //Whether or not the client side prediction tries to smooth things out
    client_smooth: 25,            //amount of smoothing to apply to client update dest

    net_latency: 0.001,           //the latency between the client and the server (ping/2)
    net_ping: 0.001,              //The round trip time from here to the server,and back
    last_ping_time: 0.001,        //The time we last sent a ping
    fake_lag: 0,                //If we are simulating lag, this applies only to the input client (not others)
    fake_lag_time: 0,

    net_offset: 100,              //100 ms latency between server and client interpolation for other clients
    buffer_size: 2,               //The size of the server history to keep for rewinding/interpolating.
    target_time: 0.01,            //the time where we want to be in the server timeline
    oldest_tick: 0.01,            //the last time tick we have available in the buffer

    client_time: 0.01,            //Our local 'clock' based on server time - client interpolation(net_offset).
    server_time: 0.01,            //The time the server reported it was at, last we heard from it
    
    dt: 0.016,                    //The time that the last frame took to run
    fps: 0,                       //The current instantaneous fps (1/this.dt)
    fps_avg_count: 0,             //The number of samples we have taken for fps_avg
    fps_avg: 0,                   //The current average fps displayed in the debug UI
    fps_avg_acc: 0,               //The accumulation of the last avgcount fps samples

    lit: 0,
    llt: new Date().getTime(),

    client_has_input: false
}
