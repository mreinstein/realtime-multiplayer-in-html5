export default function createNetClientComponent () {

	const client = {
		// A list of recent server updates we interpolate across
	    // This is the buffer that is the driving factor for our networking
	    server_updates: [ ],

	    socket: undefined,
	    
	    input_seq: 0,                 // When predicting client inputs, we store the last input as a sequence number
	    client_smoothing: true,       // Whether or not the client side prediction tries to smooth things out
	    client_smooth: 25,            // amount of smoothing to apply to client update dest

	    net_latency: 0.001,           // the latency between the client and the server (ping/2)
	    net_ping: 0.001,              // The round trip time from here to the server,and back
	    last_ping_time: 0.001,        // The time we last sent a ping
	    fake_lag: 0,                  // If we are simulating lag, this applies only to the input client (not others)
	    
	    interpolation_offset: 0.1,    // 0.1s latency between server and client interpolation for other clients
	    buffer_size: 2,               // The size of the server history to keep for rewinding/interpolating.
	    target_time: 0.01,            // the time where we want to be in the server timeline
	    //oldest_tick: 0.01,            // the last time tick we have available in the buffer

	    client_time: 0.01,            // Our local 'clock' based on server time - client interpolation(interpolation_offset).
	    server_time: 0.01             // The time the server reported it was at, last we heard from it
	};

	return client;
}
