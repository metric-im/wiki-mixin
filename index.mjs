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
                let code = decodeURIComponent(req.query.txt)
                code = code.replace(/^@startuml/i,"");
                code = code.replace(/@enduml$/i,"");
                let header = `skinparam backgroundColor transparent\n`
                let gen = plantuml.generate(`@startuml\n${header}\n${code}\n@enduml`,{format: 'png'});
                gen.out.pipe(res);
            } catch(e) {
                res.status(e.status||500).json({status:"error",message:e.message});
            }
        });
        return router;
    }
    async getIndex(account) {
        let publicResults = await this.collection.find({"_id.a":'public'}).sort({"_id.d":1}).project({_id:"$_id",_pid:1,title:1,listed:1,rootmenu:1}).toArray();
        let accountResults = await this.collection.find({"_id.a":account.id}).sort({"_id.d":1}).project({_id:"$_id",_pid:1,title:1,listed:1,rootmenu:1}).toArray();
        let results = await this.collection.find({"_id.a":account.userId}).sort({"_id.d":1}).project({_id:"$_id",_pid:1,title:1,listed:1,rootmenu:1}).toArray();
        for (let a of accountResults) {
            if (results.find(r=>r._id.d===a._id.d)) continue;
            else results.push(a);
        }
        for (let a of publicResults) {
            if (results.find(r=>r._id.d===a._id.d)) continue;
            else results.push(a);
        }
        return results;
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
            doclet = {_id:{d:docId,a:account.id},_pid:options._pid,title:docId,listed:true,body:`# ${docId}\n`};
        }
        doclet.visibility = doclet._id.a;
        return doclet;
    }
    async put(account,docId,options={},body={}) {
        if (!docId) throw new Error('Id is required');
        // initialize id
        if (!body._id) body._id = {a:body.visibility||account.id,d:docId};
        // get existing doc(s) across all visibility zones
        let docList = await this.collection.find({"_id.d":docId}).toArray();
        let docMap = {user:null,account:null,public:null}
        for (let doc of docList) {
            if (doc._id.a === account.userId) docMap.user = doc;
            else if (doc._id.a === account.id) docMap.account = doc;
            else if (doc._id.a === 'public') docMap.public = doc;
        }
        // manage visibility
        let deletes = [];
        if (body.visibility && body._id.a !== body.visibility) {
            if (body.visibility === account.id && body._id.a === account.userId) {
                if (docMap.account && docMap.account._modified > body._created) {
                    throw new Error('Merge conflict');
                } else {
                    if (docMap.user) deletes.push(docMap.user._id);
                }
            }
            if (body.visibility === 'public') {
                if (docMap.public && docMap.public._modified > body._created) {
                    throw new Error('Merge conflict');
                } else {
                    if (docMap.user) deletes.push(docMap.user._id);
                    if (docMap.account) deletes.push(docMap.account._id);
                }
            }
            body._id.a = body.visibility;
        }
        if (body._id.a === 'public' && !account.super) {
            throw new Error('unauthorized');
        }
        if (!body._created) body._created = new Date();
        if (!body._createdBy) body._createdBy = account.userId;
        body._modified = new Date();
        delete body.visibility;
        try {
            let result = await this.collection.findOneAndUpdate({_id:body._id},{$set:body},{upsert:true,returnNewDocument:true});
            if (result.ok && deletes.length > 0) {
                await this.collection.deleteMany({_id:{$in:deletes}});
            }
            return body;
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
