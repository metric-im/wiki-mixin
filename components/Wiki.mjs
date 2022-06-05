import Component from "./Component.mjs";
import WikiPage from "./WikiPage.mjs"

export default class Wiki extends Component {
    constructor(props) {
        super(props);
    }
    async render(element) {
        await super.render(element);
        let docId = window.location.hash.split('/')[1] || "WikiHome";
        let page = new WikiPage({docId:docId,path:"/#Wiki",context:this.props.context});
        await page.render(this.element);
    }
}
