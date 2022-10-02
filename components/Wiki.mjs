import Component from "./Component.mjs";
import WikiPage from "./WikiPage.mjs"

export default class Wiki extends Component {
    constructor(props) {
        super(props);
        this.root = "Docs";
    }
    async render(element) {
        await super.render(element);
        let docId = window.location.hash.split('/')[1] || this.root;
        docId = docId.split('?')[0];
        let options = window.location.hash.replace(/.*?\?/,'')
            .split("&")
            .map(function(n){return n = n.split("="),this[n[0]] = n[1],this}.bind({}))[0];
        let API = await import('./API.mjs');
        if (API) options.dataSource = API.default;
        let page = new WikiPage({docId:docId,path:"/#Wiki",context:this.props.context});
        await page.render(this.element,options);
    }
}
