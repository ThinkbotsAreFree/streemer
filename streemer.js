


function Vector(object) {

    this.vector = Object.assign({}, object)
}



Vector.prototype.clone = function () {

    return new Vector(this.toObject());
}



Vector.prototype.toObject = function () {

    return Object.assign({}, this.vector);
}



Vector.prototype.getComponents = function () {

    return Object.keys(this.vector);
}



Vector.prototype.get = function (component) {

    return this.vector[component];
}



Vector.prototype.set = function (component, value) {

    this.vector[component] = value;
}



Vector.prototype.isEqual = function (vector) {

    const keys = this.getComponents();
    const vectorKeys = vector.getComponents();

    if (keys.length !== vectorKeys.length) return false;

    for (let i = 0; i < keys.length; i += 1) {

        const k = keys[i];
        if (this.vector[k] !== vector.vector[k]) return false;
    }
    return true;
}



Vector.prototype.getDistance = function (vector) {

    const tmpVector = this.clone().subtract(vector);
    let d = 0;

    tmpVector.getComponents().forEach((k) => {

        d += tmpVector.vector[k] * tmpVector.vector[k];
    });

    return Math.sqrt(d);
}



Vector.prototype.getLength = function () {

    let l = 0;
    this.getComponents().forEach((k) => {
        l += this.vector[k] * this.vector[k];
    });
    return Math.sqrt(l);
}



Vector.prototype.getDotProduct = function (vector) {

    let dotProduct = 0;
    this.getComponents().forEach((k) => {
        if (vector.vector[k] !== undefined) {
            dotProduct += this.vector[k] * vector.vector[k];
        }
    });
    return dotProduct;
}



Vector.prototype.getCosineSimilarity = function (vector) {

    return this.getDotProduct(vector) / (this.getLength() * vector.getLength());
}



Vector.prototype.normalize = function () {

    const l = this.getLength();
    return this.divide(l);
}



Vector.prototype.add = function (vector) {

    vector.getComponents().forEach((k) => {
        if (this.vector[k] !== undefined) {
            this.vector[k] += vector.vector[k];
        } else {
            this.vector[k] = vector.vector[k];
        }
    });
    return this;
}



Vector.prototype.subtract = function (vector) {

    vector.getComponents().forEach((k) => {
        if (this.vector[k] !== undefined) {
            this.vector[k] -= vector.vector[k];
        } else {
            this.vector[k] = -vector.vector[k];
        }
    });
    return this;
}



Vector.prototype.multiply = function (scalar) {

    this.getComponents().forEach((k) => {
        this.vector[k] *= scalar;
    });
    return this;
}



Vector.prototype.divide = function (scalar) {

    this.getComponents().forEach((k) => {
        this.vector[k] /= scalar;
    });
    return this;
}



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



Streemer.prototype.V = function (object) {

    return new Vector(object);
}



Streemer.prototype.id = function () {
    var id = 0n;
    return function (prefix) {
        return prefix + (id++);
    }
}()



Streemer.prototype.type = function (structure) {

    this.types.push(Object.assign({ id: this.id("Type") }, structure));
}



Streemer.prototype.policy = {};



Streemer.prototype.policy.clone = function (type, server) {

    if (this.match(type, server))
        this.node(type, server);
}



Streemer.prototype.policy.once = function (type, server) {

    if (this.match(type, server) && !server.types.includes(type))
        this.node(type, server);
}



Streemer.prototype.policy.keep = function (type, server) {

    if (this.match(type, server) && !server.clients.map(client => client.type).includes(type))
        this.node(type, server);
}



Streemer.prototype.policy.check = function (type, server) {

    if (this.match(type, server)) {
        if (!server.clients.map(client => client.type).includes(type))
            this.node(type, server);
    } else {
        for (let client of server.clients)
            if (client.type === type)
                this.remove(client);
    }
}



Streemer.prototype.remove = function (node) {

    node.garbage = true;
    for (let client of node.clients) this.remove(client);
}



Streemer.prototype.node = function (type, server) {

    let node = {
        id: this.id("Node"),
        type: type,
        server: server,
        clients: [],
        inbox: [],
        offer: Object.assign({}, type.serverside.offer)
    };
    node.type.clientside.init(server, node);
    if (server.type.serverside.connect(node, server)) {
        server.clients.push(node);
        server.types.push(type);
        this.pending.push(node);
    }
}



Streemer.prototype.grow = function () {

    for (let node of this.nodes)
        for (let type of this.types)
            type.clientside.policy.call(this, type, node);
    this.nodes = this.nodes.concat(this.pending);
    this.pending = [];
}



Streemer.prototype.match = function (type, node) {

    for (let key in type.clientside.context)
        if (!type.clientside.context[key](node.offer[key]))
            return false;

    return true;
}



Streemer.prototype.msg = function (sender, data, target) {

    let receiver = target || sender.server;
    receiver.inbox.push({
        sender: sender,
        data: data,
        isUpload: receiver === sender.server
    });
}



Streemer.prototype.feed = function () {

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



Streemer.prototype.run = function (interval) {

    let start = Date.now();

    for (let node of this.nodes)
        if (node.type.tick) node.type.tick.call(this, node);
    this.feed();
    this.grow();
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
        return true;
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
    tick: node => { },
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
