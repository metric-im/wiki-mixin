class API {
    static get base() {
        return window._ENV.VUE_APP_API;
    }
    static async get(path,options={},format="json") {
        if (path.charAt(0) !== '/') path = '/'+path;
        options.credentials = 'include';
        let response = await fetch(API.base+path,options);
        if (response.ok) return await response[format]();
        else {
            let e = new Error(`failed to fetch ${path}`);
            e.status = response.status;
            e.response = await response.text();
            throw(e);
        }
    }
    static async getText(path,options) {
        return await this.get(path,options,'text');
    }
    static async put(path,body) {
        if (path.charAt(0) !== '/') path = '/'+path;
        let options = {method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)};
        let response = await fetch(API.base+path,options);
        if (response.ok) return await response.json();
        else {
            let e = new Error(`failed update ${path}`);
            e.status = response.status;
            e.response = await response.text();
            throw(e);
        }
    }
    static async remove(path) {
        if (path.charAt(0) !== '/') path = '/'+path;
        let options = {method:'DELETE',credentials:'include',headers:{'Content-Type':'application/json'}};
        let response = await fetch(API.base+path,options);
        if (!response.ok) {
            let e = new Error(`failed remove ${path}`);
            e.status = response.status;
            e.response = await response.text();
            throw(e);
        }
    }
    static async test() {
        let response = await fetch(API.base+'/session/test', {credentials:'include'});
        return (response.ok);
    }
}
export default API;