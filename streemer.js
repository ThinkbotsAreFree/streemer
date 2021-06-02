



function Streemer(type) {

    this.types = [];

    this.root = {
        id: this.id("Root"),
        type: {
            serverside: {
                offer: type.offer,
                connect: type.connect,
                upload: type.upload
            }
        },
        server: null,
        clients: [],
        types: [],
        inbox: [],
        offer: type.offer
    };
    
    this.nodes = [this.root];
    this.pending = [];
}



Streemer.prototype.id = function() {
    var id = 0n;
    return function(prefix) {
        return prefix + (id++);
    }
}()



Streemer.prototype.type = function(structure) {

    this.types.push(Object.assign({ id: this.id("Type") }, structure));
}



Streemer.prototype.policy = {};



Streemer.prototype.policy.every = function(type, server) {

    if (this.match(type, server))
        this.node(type, server);
}



Streemer.prototype.policy.once = function(type, server) {

    if (this.match(type, server) && !server.types.includes(type))
        this.node(type, server);
}



Streemer.prototype.policy.keep = function(type, server) {

    if (this.match(type, server) && !server.clients.map(client => client.type).includes(type))
        this.node(type, server);
}



Streemer.prototype.policy.check = function(type, server) {

    if (this.match(type, server)) {
        if (!server.clients.map(client => client.type).includes(type))
            this.node(type, server);
    } else {
        for (let client of server.clients)
            if (client.type === type)
                this.remove(client);
    }
}



Streemer.prototype.remove = function(node) {

    for (let client of node.clients) this.remove(client);
    node.garbage = true;
}



Streemer.prototype.node = function(type, server) {

    let node = {
        id: this.id("Node"),
        type: type,
        server: server,
        clients: [],
        inbox: [],
        offer: Object.assign({}, type.serverside.offer)
    };
    node.type.clientside.init(server, node);
    server.type.serverside.connect(node, server);

    server.clients.push(node);
    server.types.push(type);
    this.pending.push(node);
}



Streemer.prototype.grow = function() {

    for (let node of this.nodes)
        for (let type of this.types)
            type.clientside.policy.call(this, type, node);
    this.nodes = this.nodes.concat(this.pending);
    this.pending = [];
}



Streemer.prototype.match = function(type, node) {

    for (let key in type.clientside.context)
        if (!type.clientside.context[key](node.offer[key]))
            return false;
    
    return true;
}



Streemer.prototype.msg = function(sender, data, target) {

    let receiver = target || sender.server;
    receiver.inbox.push({
        sender: sender,
        data: data,
        isUpload: receiver === sender.server
    });
}



Streemer.prototype.feed = function() {

    for (let node of this.nodes) {
        let msg = node.inbox.shift();
        if (msg) {
            if (msg.isUpload)
                node.type.serverside.upload(msg, node);
            else
                node.type.clientside.download(msg, node);
        }
    }
}



Streemer.prototype.run = function(interval) {

    let start = Date.now();

    this.grow();
    this.feed();
    this.nodes = this.nodes.filter(node => !node.garbage);

    if (arguments.length) setTimeout(
        () => this.run(interval),
        Math.max(0, interval - (Date.now() - start))
    );
}











var s = new Streemer({
    offer: {
        who: "root",
        what: "foo"
    },
    connect: (client, node) => {
        console.log("[root connecting client]", client.id);
    },
    upload: (data, node) => {
        console.log("[root uploading]", data);
    }
});



s.type({
    clientside: {
        policy: s.policy.keep,
        context: {
            who: who => who == "root"
        },
        init: (server, node) => {
            console.log("[client init to server]", server.id);
        },
        download: (data, node) => {
            console.log("[client download]", data);
        }
    },
    serverside: {
        offer: {
            x: 1,
            y: 2,
            z: 3
        },
        connect: (client, node) => { },
        upload: (data, node) => { }
    }
});


s.run(1000);






// zero
