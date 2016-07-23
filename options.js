var storage = chrome.storage.local;
var useStyle = document.getElementById("useStyle");
var modStyle = document.getElementById("modStyle");

var defaultOptions = {
    "useStyle": true,
    "modStyle": "border: 1px dashed green"
};

storage.get(defaultOptions, function(opts) {
    useStyle.checked = opts.useStyle;
    modStyle.value = opts.modStyle;
    modStyle.style.display = useStyle.checked ? '' : 'none';
});

useStyle.addEventListener("change", function(e) {
    storage.set({"useStyle": this.checked});
    modStyle.style.display = this.checked ? '' : 'none';
});

modStyle.addEventListener("change", function(e) {
    storage.set({"modStyle": this.value});
});
