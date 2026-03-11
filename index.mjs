import express from 'express';
import Componentry from "@metric-im/componentry";
import fs from "fs";
import {resolve} from "path";
import moment from "moment";
import jsonic from "jsonic";

export default class WikiMixin extends Componentry.Module {
    constructor(connector) {
        super(connector,import.meta.url);
        this.connector = connector;
        this.collection = this.connector.db.collection('wiki');
        this.rootDoc = "Home";
    }
    static async mint(connector) {
        let instance = new WikiMixin(connector);
        instance.gatherDoclets();
        return instance;
    }
    gatherDoclets() {
        if (!this.doclets) {
            this.doclets = [];
            // reload in case componentry is not yet fully loaded
            setTimeout(this.gatherDoclets.bind(this),5000);
        }
        Object.values(this.connector.componentry.modules).forEach(module=>{
            let path = module.rootPath+'/doclets';
            if (fs.existsSync(path)) {
                let doclets = fs.readdirSync(path);
                for (let doclet of doclets) this.doclets[doclet.split('.')[0]] = path+'/'+doclet;
            }
        })
    }
    routes() {
        const router = express.Router();
        router.use('/wiki',(req,res,next)=>{
            if (req.account && req.account.id) next();
            else res.status(401).send();
        });
        router.use('/wiki/src',express.static(`${this.rootPath}/src_modules`));
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
                if (this.doclets[req.params.docId]) {
                    if (method !== 'get') return res.status(403).send();
                    else {
                        let md = fs.readFileSync(this.doclets[req.params.docId]).toString();
                        res.json({
                            _id:req.params.docId,
                            title:req.params.docId,
                            _locked:true,
                            body:md
                        });
                    }
                } else {
                    let options = Object.assign({_pid:req.cookies._pid||""},req.query)
                    let result = await this[method](req.account,req.params.docId,options,req.body);
                    if (!result && method !== 'put') return res.status(401).send();
                    let expires = moment().add( 1 ,'hour').toDate();
                    res.cookie("_pid",req.params.docId,{expires:expires,sameSite:"Strict"});
                    res.json(result);
                }
            } catch(e) {
                console.error(`Error invoking ${req.method} on data`,e);
                res.status(500).send(`Error: ${e.message}`);
            }
        });
        router.get("/wikisettings/:docId?",async(req,res)=>{
            try {
                // docId is not honored until assured it's not a security hole
                const result = await this.getSettings(req.account,'WikiSettings');
                res.json(result);
            } catch(e) {
                console.error(`Error fetching wikisettings`,e);
                res.status(500).send(`Error: ${e.message}`);
            }
        })
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
        // check write access
        const writeAccess = await this.connector.acl.test.write({user: account.userId}, {account: account.id});
        if (!writeAccess) throw new Error('unauthorized');
        // initialize id (IMPORTANT: MongoDB _id objects are order-sensitive!)
        if (!body._id) body._id = {d:docId,a:body.visibility||account.id};
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
            if (result?.ok && deletes.length > 0) {
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
    get library() {
        return {
          'xipper':'/xipper/xipper.bundle.js',
          'firemacro': '/@metric-im/firemacro/index.mjs'
        };
    }
    async getSettings(account,docId) {
        let settings = {};
        const doclet = await this.get(account,docId);
        if (doclet) {
            const lines = doclet.body.split('\n');
            let currentObj = settings;
            let objStack = [settings];
            let nameStack = [];

            for (let line of lines) {
                line = line.trim();

                // Parse headings
                const headingMatch = line.match(/^(#+)\s+(.+)$/);
                if (headingMatch) {
                    const level = headingMatch[1].length;
                    const name = this.normalizePropertyName(headingMatch[2]);

                    // Adjust stack to appropriate level
                    while (objStack.length > level) {
                        objStack.pop();
                        nameStack.pop();
                    }

                    // Create new object
                    const newObj = {};
                    objStack[objStack.length - 1][name] = newObj;
                    objStack.push(newObj);
                    nameStack.push(name);
                    currentObj = newObj;
                    continue;
                }

                // Parse bullet points (attributes)
                const bulletMatch = line.match(/^\*\s+(.+?)\s*=\s*(.*)$/);
                if (bulletMatch) {
                    const name = this.normalizePropertyName(bulletMatch[1]);
                    let value = bulletMatch[2].replace(/;$/,'').trim();

                    // Parse value type
                    if (value === '') {
                        value = '';
                    } else if (value === 'true') {
                        value = true;
                    } else if (value === 'false') {
                        value = false;
                    } else if (!isNaN(value) && value !== '') {
                        value = Number(value);
                    } else {
                        try {
                            value = jsonic(value);
                        } catch(e) {
                            // If jsonic fails, keep as string
                        }
                    }

                    currentObj[name] = value;
                }
            }
        }
        // The top headline is dropped. It is the settings page name
        return Object.entries(settings)[0][1]
    }

    normalizePropertyName(name) {
        // Split on spaces and non-alphanumeric characters
        const words = name.split(/[\s_-]+/).filter(w => w.length > 0);

        // Convert to camelCase
        return words.map((word, index) => {
            if (index === 0) return word.charAt(0).toLowerCase() + word.slice(1);
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join('');
    }
}
