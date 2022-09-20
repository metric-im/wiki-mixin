import express from 'express';
import plantuml from 'node-plantuml';
import path from "path";
import {fileURLToPath} from "url";
export default class WikiMixin {
    constructor(connector) {
        this.connector = connector;
        this.collection = this.connector.db.collection('wiki');
        this.rootDoc = "Home";
        this.rootPath = path.dirname(fileURLToPath(import.meta.url));
        this.componentPath = this.rootPath+'/components';
        this.umlOptions = {};
    }
    routes() {
        const router = express.Router();
        router.use('/wiki',(req,res,next)=>{
            if (req.account && req.account.id) next();
            else res.status(401).send();
        })
        router.get("/wiki/index",async(req,res)=>{
            try {
                let result = await this.getIndex(req.account);
                res.json(result);
            } catch(e) {
                console.error(e);
                res.status(500).send(`Error: ${e.message}`);
            }
        })
        router.all("/wiki/:docId?",async(req,res)=>{
            try {
                let method = req.method.toLowerCase();
                let result = await this[method](req.account,req.params.docId,req.query,req.body);
                if (!result && method !== 'put') res.status(401).send();
                else res.json(result);
            } catch(e) {
                console.error(`Error invoking ${req.method} on data`,e);
                res.status(500).send(`Error: ${e.message}`);
            }
        });
        router.get('/uml/',async(req,res)=>{
            try {
                res.set('Content-Type', 'image/png');
                let header = "";
                if (this.umlOptions.backgroundColor) header += `skinparam backgroundColor ${this.umlOptions.backgroundColor}\n`
                let gen = plantuml.generate(header+decodeURIComponent(req.query.txt),{format: 'png'});
                gen.out.pipe(res);
            } catch(e) {
                res.status(e.status||500).json({status:"error",message:e.message});
            }
        });
        router.get('/wikitoc/:root?',async (req,res)=>{
            if (req.params.root) $match._id
            let doclets = await this.collection.find({"_id.a":{$in:['public',req.account.id,req.account.userId]},listed:{$gt:0}})
                .sort({_pid:1,listed:1,"_id.d":1})
                .project({_id:1,_pid:1,title:1}).toArray();
            let result = [doclets.find(d=>(d._id.d===(req.params.root||this.rootDoc)))];
            if (!result[0]) return res.status(404).send();
            let maxDepth = 10;
            let depth = 0;
            traverse(result[0]);
            function traverse(parent) {
                if (++depth > maxDepth) return;
                for (let doc of doclets) {
                    if (doc._pid && doc._pid.a === parent._id.a && doc._pid.d === parent._id.d) {
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
    async getIndex(account) {
        let publicResults = this.collection.find({"_id.a":'public'}).sort({"_id.d":1}).project({_id:1,_pid:1,title:1,listed:1,rootmenu:1}).toArray();
        let accountResults = this.collection.find({"_id.a":account.id}).sort({"_id.d":1}).project({_id:1,_pid:1,title:1,listed:1,rootmenu:1}).toArray();
        let userResults = this.collection.find({"_id.a":account.userId}).sort({"_id.d":1}).project({_id:1,_pid:1,title:1,listed:1,rootmenu:1}).toArray();
        return Object.assign(publicResults,accountResults,userResults);
    }
    async get(account,docId,options={}) {
        if (!docId) docId = this.rootDoc;
        let doclets = await this.collection.find({"_id.d":docId,"_id.a":{$in:[account.id,account.userId,'public']}}).toArray();
        let doclet = null;
        if (doclets.length > 0) {
            doclets.sort((a,b)=>{
                if (a._id.a === account.userId) return -1;
                else if (b._id.a === account.userId) return 1;
                else if (a._id.a === 'public') return 1;
                else if (b._id.a === 'public') return -1;
                else return 0;
            });
            doclet = doclets[0];
        } else {
            doclet = {_id:{d:docId,a:account.userId},_pid:options.pid,title:docId,listed:true,body:`# ${docId}\n`};
        }
        doclet.visibility = doclet._id.a;
        return doclet;
    }
    async put(account,docId,options={},body={}) {
        if (!docId) throw new Error('Id is required');
        if (body._id) {
            if (body.visibility && body._id.a !== body.visibility) body._id.a = body.visibility;
        } else {
            body._id = {a:body.visibility||account.userId,d:docId};
        }
        if (body._id.a === 'public' && !account.super) {
            throw new Error('unauthorized');
        }
        if (!body._created) body._created = new Date();
        if (!body._createdBy) body._createdBy = account.userId;
        body._modified = new Date();
        try {
            let doclet = await this.collection.findOneAndUpdate({_id:body._id},{$set:body},{upsert:true,returnNewDocument:true});
            return doclet.value
        } catch(e) {
            console.log(e);
        }
    }
    set umlBackgroundColor(val) {
        this.umlOptions.backgroundColor = val;
    }
    get umlBackgroundColor() {
        return this.umlOptions.backgroundColor;
    }
}
