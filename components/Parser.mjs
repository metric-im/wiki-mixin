export default class Parser {
    static summarize(body) {
        let match = body.match(/(^[A-Za-z]{1}.*$)/m);
        if (match) return match[1];
        else return "";
    }
}