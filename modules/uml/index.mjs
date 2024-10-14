import plantuml from 'node-plantuml';
import Componentry from "@metric-im/componentry";
import fs from "fs";
import FireMacro from "./components/FireMacro.mjs";
import path from "path";
import express from "express";

export default class UML extends Componentry.Module {
  constructor(connector) {
    super(connector, import.meta.url);
    this.header = `skinparam backgroundColor transparent\n`
    this.umlOptions = {};
  }
  routes() {
    const router = express.Router();
    router.use('/uml/modules',express.static(`${this.rootPath}/modules`));
    router.get('/uml/draw/:code?',(req,res)=> {
      try {
        let code = decodeURIComponent(req.params.code || req.query.code || req.query.txt); // txt is deprecated
        if (!code) return res.status(400).send({error: 'No code provided'});
        let gen = this.generate(code);
        res.set('Content-Type', 'image/png');
        gen.out.pipe(res);
      } catch (e) {
        res.status(e.status || 500).json({status: "error", message: e.message});
      }
    })
    router.get('/uml/edit/:code?',(req,res)=>{
      try {
        let code = decodeURIComponent(req.params.code || req.query.code || req.query.txt); // txt is deprecated
        res.sendFile(`${this.rootPath}/editor.html`)
      } catch (e) {
        res.status(e.status || 500).json({status: "error", message: e.message});
      }
    })
  }

  /**
   * Generate a UML image from the given PlantUML code
   * @param code
   * @returns *Buffer
   */
  generate(code) {
    code = code.replace(/^@startuml/i, "");
    code = code.replace(/@enduml$/i, "");
    return plantuml.generate(`@startuml\n${this.header}\n${code}\n@enduml`, {format: 'png'});
  }
}
