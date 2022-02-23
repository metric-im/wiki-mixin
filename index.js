let fs = require('fs');
const plantuml = require("node-plantuml");
const Identifier = require("@metric-im/identifier");
const express = require("express");
const path = require("path");

class Wiki {
    constructor(connector) {
        this.connector = connector;
        this.collection = this.connector.db.collection('wiki');
        this.rootDoc = "WikiHome";
    }
    routes() {
        const plantuml = require('node-plantuml');
        const router = require('express').Router();
        // connect public site folder (root styles, images and other assets)
        router.use("/_wiki",express.static(path.join(__dirname, 'site')));
        router.use("/_wiki/components",express.static(path.join(__dirname, 'components')));
        router.get('/_wiki/lib/:module',getLibraryModule);
        router.get('/_wiki/lib/:module/:path',getLibraryModule);
        router.all("/wiki/:docId?",async(req,res)=>{
            try {
                let result = await this[req.method.toLowerCase()](req.params.docId,req.query,req.body);
                res.json(result);
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

        return router;
    }
    async get(docId,options={}) {
        try {
            if (!docId) docId = this.rootDoc;
            let doclet = await this.collection.findOne({_id:docId});
            if (!doclet) doclet = {_id:docId,title:docId,body:`# ${docId}\n`};
            return doclet;
        } catch(e) {
            return '# '+docId;
        }
    }
    async put(docId,options={},body={}) {
        if (!body._id) body._id = docId?docId:Identifier.new;
        if (!body.created) body.create = new Date();
        body.modified = new Date();
        let doclet = await this.collection.findOneAndUpdate({_id:docId},{$set:body},{upsert:true,returnNewDocument:true});
        return doclet;
    }
}

function getLibraryModule(req,res) {
    let library = {
        'moment':'/node_modules/moment/moment.js',
        'marked':'/node_modules/marked/lib/marked.esm.js',
        // 'marked':'/node_modules/marked/marked.min.js',
        'brace':'/node_modules/brace/',
    };
    let path = library[req.params.module];
    if (req.params.path) path += req.params.path;
    if (!path) return res.status(404).send();
    res.set("Content-Type","text/javascript");
    res.sendFile(__dirname+path);
}

module.exports = Wiki;