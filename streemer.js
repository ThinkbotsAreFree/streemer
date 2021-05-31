



function Streemer() {

    this.types = [];
    this.nodes = [];

    this.root = this.node({
        client: {},
        server: {}
    });
}



Streemer.prototype.type = function(structure) {

    this.types.push(structure);
}



Streemer.prototype.node = function(type, server) {

    let node = {
        type: type,
        server: server,
        clients: [],
        inbox: [],
        offer: Object.assign({}, type.serverside.offer)
    };
    node.type.clientside.init(server, node);
    server.type.serverside.connect(node, server);

    server.clients.push(node);
    this.nodes.push(node);
}



Streemer.prototype.grow = function() {

    for (let node of this.nodes)
        for (let type of this.types)
            if (this.match(node, type))
                this.node(type, node);
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



Streemer.prototype.handleMessages = function() {

    for (let node in this.nodes) {
        let msg = node.inbox.shift();
        if (msg) {
            if (msg.isUpload)
                node.type.serverside.upload(msg);
            else
                node.type.clientside.download(msg);
        }
    }
}






var s = new Streemer();



s.type({
    clientside: {
        context: {
            t: v => v == "ok",
            x: x => x > 10
        },
        init: (server, node) => { },
        download: (data) => { }
    },
    serverside: {
        offer: {
            x: 1,
            y: 2,
            z: 3
        },
        connect: (client, node) => { },
        upload: (data) => { }
    }
});








