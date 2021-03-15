Forked Copy
=============================

The original repository this is from is essentially frozen. It includes reference material for an article on game networking, so the author is understandably reluctant to change it. 

Here's what my changes do:
* re-design the architecture from object oriented to data oriented design
* re-design the game client around an Entity Component System (ECS)
* use es modules everywhere
* switch the position object format from `{ x, y }` to `[ x, y ]`
* move number functions to not extend the built in number type
* player input is sent every tick, even if no keys are pressed. When networking simulations where things can affect object positions even without player input (e.g., falling due to gravity) we should still send data so that the physics update runs for every client frame on the server.


Realtime Multiplayer In HTML5
=============================

Read the article here : 
http://buildnewgames.com/real-time-multiplayer/

View the demo here :
http://notes.underscorediscovery.com:4004/?debug

An example using node.js, socket.io and HTML5 Canvas to explain and demonstrate realtime multiplayer games in the browser.


## Usage

### Installation
```bash
npm install
```

### Running
```bash
npm start
```

Then Visit http://127.0.0.1:4004/?debug


## License

MIT Licensed. 
See LICENSE if required.

