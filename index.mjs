import express from 'express';
import plantuml from 'node-plantuml';
import path from "path";
import {fileURLToPath} from "url";
export default class Wiki {
    constructor(connector) {
        this.connector = connector;
        this.collection = this.connector.db.collection('wiki');
        this.rootDoc = "WikiHome";
        this.rootPath = path.dirname(fileURLToPath(import.meta.url));
        this.componentPath = this.rootPath+'/components';
    }
    routes() {
        const router = express.Router();
        router.use('/wiki',(req,res,next)=>{
            if (req.account && req.account.id) next();
            else res.status(401).send();
        })
        router.all("/wiki/:docId?",async(req,res)=>{
            try {
                let result = await this[req.method.toLowerCase()](req.account,req.params.docId,req.query,req.body);
                if (!result) res.status(401).send();
                else res.json(result);
            } catch(e) {
                console.error(`Error invoking ${req.method} on data`,e);
                res.status(500).send(`Error invoking ${req.method} on data: ${e.message}`);
            }
        });
        router.get('/uml/',async(req,res)=>{
            try {
                res.set('Content-Type', 'image/png');
                let gen = plantuml.generate(decodeURIComponent(req.query.txt),{format: 'png'});
                gen.out.pipe(res);
            } catch(e) {
                res.status(e.status||500).json({status:"error",message:e.message});
            }
        });
        router.get('/wikitoc/:root?',async (req,res)=>{
            let doclets = await this.collection.find({listed:{$gt:0}})
                .sort({_pid:1,listed:1,_id:1})
                .project({_id:1,_pid:1,title:1}).toArray();
            let result = [doclets.find(d=>(d._id===(req.params.root||this.rootDoc)))];
            let maxDepth = 10;
            let depth = 0;
            traverse(result[0]);
            function traverse(parent) {
                if (++depth > maxDepth) return;
                for (let doc of doclets) {
                    if (doc._pid && doc._pid === parent._id) {
                        if (!parent.children) parent.children = [];
                        parent.children.push(doc);
                        traverse(doc);
                    }
                }
            }
            res.json(result);
        })

        return router;
    }
    async get(account,docId,options={}) {
        if (!docId) docId = this.rootDoc;
        let doclet = await this.collection.findOne({_id:docId});
        if (!doclet) doclet = {_id:docId,_pid:options.pid,title:docId,visibility:account.userId,listed:true,body:`# ${docId}\n`};
        else if (doclet.visibility && !['public',account.id,account.userId].includes(doclet.visibility)) doclet = null;
        return doclet;
    }
    async put(account,docId,options={},body={}) {
        if (!body._id) body._id = docId?docId:Identifier.new;
        if (!body._created) body.create = new Date();
        body._modified = new Date();
        let doclet = await this.collection.findOneAndUpdate({_id:docId},{$set:body},{upsert:true,returnNewDocument:true});
        return doclet;
    }
}
