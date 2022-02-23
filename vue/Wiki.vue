<template>
  <div class="controls">
    <button :class="{active: !editing}" @click="edit"><span class="icon icon-edit"/></button>
    <button :class="{active: !editing}" @click="save"><span class="icon icon-save"/></button>
    <button :class="{active: !editing}" @click="remove"><span class="icon icon-trash"/></button>
    <button :class="{active: editing}" @click="doneEditing"><span class="icon icon-check"/></button>
    <button :class="{active: editing}" @click="cancelEditing"><span class="icon icon-cross"/></button>
  </div>
  <div class="doclet-tray">
    <div class="doclet-container">
      <div :class="['doclet-render',{active:!editing}]" v-html="render"></div>
      <div :class="['doclet-edit',{active:editing}]">
        <textarea class="editor" v-model="editText"></textarea>
      </div>
    </div>
  </div>
</template>

<script>
// import remarkGfm from 'remark-gfm' // support tables and such
import {marked} from 'marked';
import API from "../components/API";
import WikiWord from "../components/WikiWord";
export default {
  data() {
    return {
      docId:null,
      doclet: {},
      render:"",
      editText:"",
      editing:false,
      path:'/site/docs'
    }
  },
  async mounted() {
    this.docId = this.$route.params.id
    this.doclet = await API.get('/wiki'+(this.docId?'/'+this.docId:""));
    this.wikiWord = new WikiWord(this.path);
    this.prepareMarked();
    this.renderHtml()
  },
  methods:{
    prepareMarked() {
      const plantuml = {
        code(code,language) {
          if (language === 'plantuml') {
            let target = API.base+"/uml?txt="+encodeURIComponent(code);
            return `<img src=${target} alt="UML Diagram"></img>`
          } else return false;
        }
      };
      marked.use({gfm:true,renderer:plantuml});
    },
    renderHtml() {
      let wordified = this.wikiWord.process(this.doclet.body);
      this.render = marked(wordified)+"\n<style>\n.doclet-container h1{margin-top:0}\n</style>";
    },
    async save() {
      let updated = await API.put('/wiki/'+this.doclet._id,this.doclet);
      if (updated) this.doclet = updated;
      // this.$vToastify.success("save");
    },
    async remove() {
    },
    edit() {
      this.editText = this.doclet.body;
      this.editing = true;
    },
    doneEditing() {
      this.doclet.body = this.editText;
      this.renderHtml();
      this.editing = false;
    },
    cancelEditing() {
      this.editing = false;
    }
  }
}
</script>

<style scoped>
TextArea h1 {
  margin-top:0;
}
.doclet-container {
  width:calc(100% - var(--spacer2));
  height:calc(100% - var(--spacer2));
  padding:var(--spacer);
}
.doclet-tray {
  overflow-y:auto;
  height:100%;
}
.doclet-render {
  display:none;
}
.doclet-edit {
  display:none;
  height:100%;
}
.active {
  display:block;
}
.controls {
  position:absolute;
  right: 16px;
  display: inline-flex;
  margin-top:-12px;
}
button {
  display:none;
  background-color:var(--tray-bg);
  padding:0;
  margin-right:4px;
  cursor:pointer;
  border:1px solid var(--text-color);
  border-radius:10px;
  width:32px;
  height:32px;
}
button:hover {
  background-color:var(--page-action);
}
.editor {
  height:100%;
  width:100%;
}
</style>
