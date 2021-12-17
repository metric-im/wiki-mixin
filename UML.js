/**
 *
 */
class UML {
    constructor() {
    }
    routes() {
        const plantuml = require('node-plantuml');
        let router = require('express').Router();
        router.get('/wiki/',async(req,res)=>{
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
}
module.exports = UML;
