


function log(label, content) {

    process.stdout.write('\x1b[45m| '+label+' |\x1b[0m ');
    console.dir(content, { depth: null })
}



function VT(object, origin) {

    this.vector = [];

    for (let key in object) this.vector.push({
        dimension: key,
        value: object[key],
        origin: origin
    });

    return this;
}



VT.prototype.clone = function () {

    let vt = new VT({});
    vt.vector = JSON.parse(JSON.stringify(this.vector));
    return vt;
}



VT.prototype.toObject = function () {

    return {
        vector: this.vector,
        parent: this.parent,
        children: this.children
    };
}



VT.prototype.getComponents = function () {

    return Object.keys(this.vector);
}



VT.prototype.get = function (component) {

    return this.vector[component];
}



VT.prototype.set = function (component, value) {

    this.vector[component] = value;
}



VT.prototype.isEqual = function (vector) {

    const keys = this.getComponents();
    const vectorKeys = vector.getComponents();

    if (keys.length !== vectorKeys.length) return false;

    for (let i = 0; i < keys.length; i += 1) {

        const k = keys[i];
        if (this.vector[k] !== vector.vector[k]) return false;
    }
    return true;
}



VT.prototype.getDistance = function (vector) {

    const tmpVT = this.clone().subtract(vector);
    let d = 0;

    tmpVT.getComponents().forEach((k) => {

        d += tmpVT.vector[k] * tmpVT.vector[k];
    });

    return Math.sqrt(d);
}



VT.prototype.getLength = function () {

    let l = 0;
    this.getComponents().forEach((k) => {
        l += this.vector[k] * this.vector[k];
    });
    return Math.sqrt(l);
}



VT.prototype.getDotProduct = function (vector) {

    let dotProduct = 0;
    this.getComponents().forEach((k) => {
        if (vector.vector[k] !== undefined) {
            dotProduct += this.vector[k] * vector.vector[k];
        }
    });
    return dotProduct;
}



VT.prototype.getCosineSimilarity = function (vector) {

    return this.getDotProduct(vector) / (this.getLength() * vector.getLength());
}



VT.prototype.normalize = function () {

    const l = this.getLength();
    return this.divide(l);
}



VT.prototype.add = function (vector) {

    vector.getComponents().forEach((k) => {
        if (this.vector[k] !== undefined) {
            this.vector[k] += vector.vector[k];
        } else {
            this.vector[k] = vector.vector[k];
        }
    });
    return this;
}



VT.prototype.subtract = function (vector) {

    vector.getComponents().forEach((k) => {
        if (this.vector[k] !== undefined) {
            this.vector[k] -= vector.vector[k];
        } else {
            this.vector[k] = -vector.vector[k];
        }
    });
    return this;
}



VT.prototype.multiply = function (scalar) {

    this.getComponents().forEach((k) => {
        this.vector[k] *= scalar;
    });
    return this;
}



VT.prototype.divide = function (scalar) {

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



Streemer.prototype.VT = function (object) {

    return new VT(object);
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










let sentence = new VT({
    sentence: 1,
    affirmative: 1
});


let role = new VT({
    role: 1,
    subject: 1
}, sentence);


let boy = new VT({
    human: 1,
    young: 1
}, role);



log("boy", boy);









/*

let testVT = new VT(
    {
        vector: { role: 1, sujet: 1 },
        children: [
            {
                vector: { nom: 1, rose: 1 }
            },
            {
                vector: { déterminant: 1, la: 1 }
            }
        ]
    }
);



log("testVT", testVT);
*/




/*
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
*/





// zero
