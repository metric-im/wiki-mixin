let fs = require('fs');

class Wiki {
    constructor(connector) {
        this.connector = connector;
    }
    routes() {
        let router = require('express').Router();
        router.all("/wiki/:docid",async(req,res)=>{
            try {
                let result = await this[req.method](req.params.docid,req.query);
                res.set("Content-Type","text/plain");
                res.send(result);
            } catch(e) {
                console.error(`Error invoking ${req.method} on data`,e);
                res.status(500).send(`Error invoking ${req.method} on data: ${e.message}`);
            }
        });
        return router;
    }
    async GET(docid,options={}) {
        let doc = fs.readFileSync(__dirname+'./docs/'+docid+".md");
        if (doc) return doc.toString();
        else return null;
    }
}

module.exports = Wiki;