<template>
  <div class="doclet-container">
    <div class="controls">
      <button :class="{active: !editing}" @click="edit"><span class="icon icon-edit"/></button>
      <button :class="{active: editing}" @click="doneEditing"><span class="icon icon-check"/></button>
      <button :class="{active: editing}" @click="cancelEditing"><span class="icon icon-cross"/></button>
    </div>
    <div :class="['doclet-render',{active:!editing}]" v-html="renderText"/>
    <div :class="['doclet-edit',{active:editing}]" contenteditable="true" @blur="updateText" ref="editor">
      {{editText}}
    </div>
  </div>
</template>

<script>
// import remarkGfm from 'remark-gfm' // support tables and such
import {computed} from 'vue';
import {marked} from 'marked';
import API from "../components/API";
export default {
  props: {
    text: String,
  },
  emits: ['update:text'],
  setup(props,{emit}) {
    const plantuml = {
      code(code,language) {
        if (language === 'plantuml') {
          let target = API.base+"/uml?txt="+encodeURIComponent(code);
          return `<img src=${target} alt="UML Diagram"></img>`
        } else return false;
      }
    };
    marked.use({gfm:true,renderer:plantuml});
    const editText = computed({
      get: () => props.text||"",
      set: (value) => {
        emit('update:text', value);
      }
    });
    const renderText = computed({
      get: () => marked(props.text||""),
    })
    return {editText,renderText};
  },
  data() {
    return {
      editing:false
    }
  },
  async mounted() {
  },
  methods:{
    edit() {
      this.editing = true;
      this.$refs.editor.focus();
    },
    updateText(e) {
      this.editText = e.target.innerText;
    },
    doneEditing() {
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
  position:relative;
  height:calc(100% - 3px);
  box-sizing:border-box;
  width:100%;
  min-height:200px;
  padding:3px;
  overflow:auto;
}
.doclet-render {
  display:none;
}
.doclet-edit {
  display:none;
  height:100%;
  padding:0 3px;
  overflow:auto;
  white-space: pre;
}
.controls {
  position:absolute;
  right: 0;
  top:0;
  display: inline-flex;
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
.active {
  display:block;
}
</style>
